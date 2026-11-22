"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bot, Compass, MessageCircle, Send, Sparkles, Sun, CloudRain, Wind, MapPin, LoaderCircle, AlertCircle, CheckCircle2 } from "lucide-react";

type Place = { id: number; name: string; country?: string; admin1?: string; latitude: number; longitude: number; timezone?: string };
type Weather = {
  current?: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; wind_speed_10m: number; precipitation: number; weather_code: number };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; precipitation_sum: number[]; wind_speed_10m_max: number[] };
};
type Activity = "sightseeing" | "beach" | "outdoors" | "relaxed";
type Message = { role: "user" | "advisor"; text: string };

const activityLabels: Record<Activity, string> = { sightseeing: "City sightseeing", beach: "Beach holiday", outdoors: "Outdoor adventure", relaxed: "Relaxed getaway" };
const weatherLabel = (code: number) => code === 0 ? "clear skies" : [1, 2].includes(code) ? "mostly clear skies" : code === 3 ? "overcast skies" : [45, 48].includes(code) ? "fog" : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code) ? "rain or showers" : [71, 73, 75, 77, 85, 86].includes(code) ? "snow" : [95, 96, 99].includes(code) ? "thunderstorms" : "mixed conditions";
const dayScore = (w: Weather, i: number, activity: Activity, priority = "comfortable temperatures") => {
  const code = w.daily.weather_code[i];
  let score = 100;
  const rainChance = w.daily.precipitation_probability_max[i] ?? 0;
  const rain = w.daily.precipitation_sum[i] ?? 0;
  const wind = w.daily.wind_speed_10m_max[i] ?? 0;
  const avg = ((w.daily.temperature_2m_max[i] ?? 0) + (w.daily.temperature_2m_min[i] ?? 0)) / 2;
  if (rainChance > 70) score -= (activity === "beach" || activity === "outdoors" ? 38 : 30) + (priority === "low chance of rain" ? 10 : 0);
  else if (rainChance > 40) score -= 18 + (priority === "low chance of rain" ? 7 : 0);
  if (rain > 8) score -= 22; else if (rain > 2) score -= 10;
  if ([95, 96, 99].includes(code)) score -= 30;
  else if ([65, 67, 82, 86].includes(code)) score -= 22;
  else if ([45, 48].includes(code)) score -= 10;
  if (wind > (activity === "beach" ? 30 : 40)) score -= 15 + (priority === "less wind" ? 10 : 0); else if (wind > 25) score -= 7 + (priority === "less wind" ? 6 : 0);
  const low = activity === "beach" ? 22 : activity === "outdoors" ? 10 : 12;
  const high = activity === "beach" ? 34 : activity === "outdoors" ? 30 : activity === "sightseeing" ? 32 : 35;
  if (avg < low) score -= (activity === "beach" ? 25 : 12) + (priority === "comfortable temperatures" ? 8 : 0);
  if (avg > high) score -= (activity === "sightseeing" || activity === "outdoors" ? 22 : 12) + (priority === "comfortable temperatures" ? 8 : 0);
  return Math.max(0, score);
};
const prettyDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

async function geocodeCity(query: string): Promise<Place | null> {
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`);
  if (!response.ok) throw new Error("City search is temporarily unavailable.");
  const data = await response.json();
  const results: Place[] = data.results || [];
  if (!results.length) return null;
  const india = results.find(p => p.country === "India");
  return india || results[0];
}
async function getForecast(place: Place): Promise<Weather> {
  const params = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude), current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code", daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max", forecast_days: "16", timezone: "auto" });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Could not retrieve a forecast for ${place.name}.`);
  return response.json();
}

export default function TravelAdvisor({ initialCity, unit }: { initialCity?: string; unit: "c" | "f" }) {
  const [mode, setMode] = useState<"guided" | "chat">("guided");
  const [destination, setDestination] = useState(initialCity || "");
  const [activity, setActivity] = useState<Activity>("sightseeing");
  const [tripLength, setTripLength] = useState("3–5 days");
  const [priority, setPriority] = useState("comfortable temperatures");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ place: Place; weather: Weather; activity: Activity } | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ role: "advisor", text: "Hi! I can assess the next 16 days of weather for a destination and activity. Try: ‘Is Jaipur suitable for sightseeing next week?’ or ‘Find the best days in Goa for a beach trip.’" }]);

  const temperature = (n: number) => `${Math.round(unit === "c" ? n : n * 9 / 5 + 32)}°${unit.toUpperCase()}`;
  const analysis = useMemo(() => {
    if (!result) return null;
    const { weather, activity: chosenActivity } = result;
    const days = weather.daily.time.map((date, i) => ({ date, i, score: dayScore(weather, i, chosenActivity, priority) })).sort((a, b) => b.score - a.score);
    const best = days.slice(0, 3).sort((a, b) => a.i - b.i);
    const avg = Math.round(days.slice(0, Math.min(7, days.length)).reduce((sum, d) => sum + d.score, 0) / Math.min(7, days.length));
    const current = weather.current;
    return { best, avg, current, outlook: avg >= 80 ? "Favourable" : avg >= 60 ? "Mixed but workable" : "Weather may disrupt some plans" };
  }, [result, priority]);

  async function analyse(city: string, chosenActivity: Activity) {
    if (!city.trim()) { setError("Enter a destination to get a weather-based recommendation."); return null; }
    setBusy(true); setError("");
    try {
      const place = await geocodeCity(city.trim());
      if (!place) throw new Error(`I couldn't find “${city}”. Try a city name such as Jaipur or Singapore.`);
      const weather = await getForecast(place);
      const next = { place, weather, activity: chosenActivity };
      setResult(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while analysing the destination.");
      return null;
    } finally { setBusy(false); }
  }

  async function submitGuided(e: FormEvent) {
    e.preventDefault();
    const next = await analyse(destination, activity);
    if (next) setMessages(current => [...current, { role: "advisor", text: `I assessed ${next.place.name} for ${activityLabels[activity].toLowerCase()} over the next 16 forecast days. The guidance below also considers your preference for ${priority} and a ${tripLength.toLowerCase()} trip as planning context; the weather score itself is based on forecast conditions.` }]);
  }

  async function submitChat(e: FormEvent) {
    e.preventDefault();
    const raw = question.trim();
    if (!raw || busy) return;
    setQuestion(""); setMessages(current => [...current, { role: "user", text: raw }]);
    const lower = raw.toLowerCase();
    if (/best time to visit|best season|when should i visit|climate|throughout the year/.test(lower)) {
      setMessages(current => [...current, { role: "advisor", text: "I can assess the live forecast for the next 16 days, but I don't yet have historical climate normals or seasonal data. I won't guess the best month or season. Ask me about the coming days instead." }]);
      return;
    }
    let chosenActivity: Activity = "sightseeing";
    if (/beach|swim|coast|sea/.test(lower)) chosenActivity = "beach";
    else if (/hike|trek|camp|outdoor|adventure/.test(lower)) chosenActivity = "outdoors";
    else if (/relax|rest|quiet|slow/.test(lower)) chosenActivity = "relaxed";
    const match = raw.match(/\b(?:in|around|at)\s+([a-z][a-z .'-]{1,35}?)(?:\s+(?:next|this|for|during|over)\b|[?.!,]|$)/i);
    const leadingCity = raw.replace(/^(?:is|will|what(?:'s| is)?|how(?:'s| is)?|would)\s+/i, "").split(/\s+(?:good|suitable|looking|for|next|this|during|over)\b/i)[0].replace(/[?.!,]/g, "").trim();
    const city = match?.[1]?.trim() || (result?.place.name && /\b(it|there|this destination|the destination)\b/.test(lower) ? result.place.name : leadingCity);
    const unsupported = /\b(flight|hotel|visa|budget|restaurant|itinerary|safety|things to do)\b/.test(lower);
    if (unsupported) {
      setMessages(current => [...current, { role: "advisor", text: "That needs information beyond the weather data available in this first phase. I can currently assess forecast suitability for sightseeing, beach holidays, outdoor activities and relaxed trips. I don't want to invent hotel, flight, visa, safety or attraction advice." }]);
      return;
    }
    const next = await analyse(city, chosenActivity);
    if (!next) return;
    const current = next.weather.current;
    const scores = next.weather.daily.time.map((date, i) => ({ date, score: dayScore(next.weather, i, chosenActivity, priority), i })).sort((a, b) => b.score - a.score);
    const top = scores[0];
    const score = Math.round(scores.slice(0, 7).reduce((sum, d) => sum + d.score, 0) / Math.min(7, scores.length));
    const answer = `${next.place.name}${next.place.country ? `, ${next.place.country}` : ""} is showing ${weatherLabel(current?.weather_code ?? 0)} right now at ${temperature(current?.temperature_2m ?? 0)}. For ${activityLabels[chosenActivity].toLowerCase()}, its next-7-day weather suitability score is ${score}/100 (${score >= 80 ? "favourable" : score >= 60 ? "mixed" : "challenging"}). The strongest forecast day in the 16-day outlook is ${prettyDate(top.date)} with a score of ${top.score}/100. This is a weather-only indication, not a guarantee or a full travel assessment.`;
    setMessages(currentMessages => [...currentMessages, { role: "advisor", text: answer }]);
  }

  return <section className="advisor-page">
    <div className="advisor-hero"><div className="eyebrow"><Sparkles size={14}/> SKYROUTE TRAVEL INTELLIGENCE</div><h1>Make your next trip<br/><span>a better-informed one.</span></h1><p className="hero-copy">A practical, weather-aware travel advisor. Tell us what you have in mind, or ask a question.</p></div>
    <div className="advisor-panel">
      <div className="advisor-mode" role="tablist" aria-label="Advisor interaction mode"><button type="button" className={mode === "guided" ? "active" : ""} onClick={() => setMode("guided")}><Compass size={15}/> Guided planner</button><button type="button" className={mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}><MessageCircle size={15}/> Ask SkyRoute</button></div>
      {mode === "guided" ? <form className="guided-form" onSubmit={submitGuided}>
        <div className="advisor-intro"><div className="advisor-icon"><Compass size={23}/></div><div><h2>Plan with a little more confidence</h2><p>Choose a destination and travel style. SkyRoute will assess the forecast and highlight promising days.</p></div></div>
        <label>Where are you thinking of going?<input value={destination} onChange={e => setDestination(e.target.value)} placeholder="e.g. Jaipur, Bali, Tokyo" /></label>
        <div className="guided-fields"><label>What kind of trip?<select value={activity} onChange={e => setActivity(e.target.value as Activity)}><option value="sightseeing">City sightseeing</option><option value="beach">Beach holiday</option><option value="outdoors">Outdoor adventure</option><option value="relaxed">Relaxed getaway</option></select></label><label>How long is your trip?<select value={tripLength} onChange={e => setTripLength(e.target.value)}><option>1–2 days</option><option>3–5 days</option><option>6–10 days</option><option>More than 10 days</option></select></label></div>
        <label>What matters most to you?<select value={priority} onChange={e => setPriority(e.target.value)}><option>comfortable temperatures</option><option>low chance of rain</option><option>less wind</option><option>a mix of conditions</option></select></label>
        <button className="advisor-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Sparkles size={17}/>} Analyse my destination</button>
      </form> : <div className="chat-advisor">
        <div className="advisor-intro"><div className="advisor-icon"><Bot size={23}/></div><div><h2>Ask SkyRoute</h2><p>Ask in your own words. I recognise a limited set of weather and activity questions—no LLM is used.</p></div></div>
        <div className="chat-messages" aria-live="polite">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}><span>{message.role === "advisor" ? <Bot size={15}/> : <MessageCircle size={15}/>}</span><p>{message.text}</p></div>)}</div>
        <div className="prompt-chips">{["Is Jaipur good for sightseeing next week?", "Beach weather in Goa?", "Best days for outdoor activities in Singapore?"].map(prompt => <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div>
        <form className="chat-input" onSubmit={submitChat}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about a destination's upcoming weather…" aria-label="Ask SkyRoute"/><button type="submit" disabled={busy || !question.trim()} aria-label="Send question">{busy ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}</button></form>
      </div>}
      {error && <div className="advisor-error"><AlertCircle size={16}/>{error}</div>}
      {busy && <div className="advisor-loading"><LoaderCircle className="spin" size={17}/> Checking destination and forecast data…</div>}
    </div>
    {result && analysis && <section className="advisor-results">
      <div className="advisor-result-head"><div><div className="eyebrow">WEATHER-BASED TRAVEL ASSESSMENT</div><h2><MapPin size={19}/>{result.place.name}<span>{[result.place.admin1, result.place.country].filter(Boolean).join(", ")}</span></h2></div><div className="advisor-outlook"><strong>{analysis.avg}/100</strong><small>{analysis.outlook}</small></div></div>
      <p className="advisor-result-copy">For a <b>{activityLabels[result.activity].toLowerCase()}</b>, the next 7 days look <b>{analysis.avg >= 80 ? "promising" : analysis.avg >= 60 ? "mixed" : "challenging"}</b> based on the forecast. Current conditions: {weatherLabel(analysis.current?.weather_code ?? 0)}, {temperature(analysis.current?.temperature_2m ?? 0)}, feels like {temperature(analysis.current?.apparent_temperature ?? 0)}.</p>
      <div className="advisor-metrics"><div><Sun size={18}/><small>HUMIDITY</small><b>{analysis.current?.relative_humidity_2m ?? "—"}%</b></div><div><Wind size={18}/><small>WIND</small><b>{Math.round(analysis.current?.wind_speed_10m ?? 0)} km/h</b></div><div><CloudRain size={18}/><small>RAIN NOW</small><b>{analysis.current?.precipitation ?? 0} mm</b></div></div>
      <h3>Most promising forecast days</h3><div className="advisor-day-grid">{analysis.best.map(day => <article key={day.date}><small>{prettyDate(day.date)}</small><strong>{day.score}<i>/100</i></strong><span>{weatherLabel(result.weather.daily.weather_code[day.i])}</span><p>High {temperature(result.weather.daily.temperature_2m_max[day.i])} · Low {temperature(result.weather.daily.temperature_2m_min[day.i])} · Rain {result.weather.daily.precipitation_probability_max[day.i]}%</p></article>)}</div>
      <p className="advisor-caveat"><CheckCircle2 size={14}/> This is a rules-based forecast assessment, not a complete travel recommendation. It does not yet consider historical climate, flight or hotel prices, local events, safety, visa rules or personal budgets. Scores are indicative, not scientifically validated probabilities.</p>
    </section>}
    <div className="advisor-capabilities"><strong>What Phase 1 can do</strong><span>Assess upcoming weather</span><span>Suggest promising forecast days</span><span>Adjust scoring by trip style</span><span>Explain its limitations</span></div>
  </section>;
}

