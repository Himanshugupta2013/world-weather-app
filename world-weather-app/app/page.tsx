"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import TravelAdvisor from "./components/TravelAdvisor";
import {
  Search, MapPin, CloudSun, Sun, Cloud, CloudRain, CloudSnow, CloudLightning,
  Wind, Droplets, Thermometer, Sunrise, Sunset, Umbrella, CalendarDays,
  Plane, Compass, LoaderCircle, ChevronDown, AlertCircle, Clock3, Plus, X, Trophy, ArrowLeftRight
} from "lucide-react";

type Place = { id: number; name: string; country?: string; admin1?: string; latitude: number; longitude: number; timezone?: string };
type Weather = {
  timezone: string;
  current?: { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; is_day: number; precipitation: number; weather_code: number; wind_speed_10m: number };
  hourly: { time: string[]; temperature_2m: number[]; apparent_temperature: number[]; precipitation_probability: number[]; precipitation: number[]; relative_humidity_2m: number[]; wind_speed_10m: number[]; weather_code: number[] };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; precipitation_sum: number[]; wind_speed_10m_max: number[]; sunrise: string[]; sunset: string[]; uv_index_max: number[] };
};

const codeInfo = (code: number) => {
  if (code === 0) return { label: "Clear sky", Icon: Sun };
  if ([1, 2].includes(code)) return { label: code === 1 ? "Mostly clear" : "Partly cloudy", Icon: CloudSun };
  if (code === 3) return { label: "Overcast", Icon: Cloud };
  if ([45, 48].includes(code)) return { label: "Foggy", Icon: Cloud };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", Icon: CloudRain };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rain", Icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", Icon: CloudSnow };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", Icon: CloudLightning };
  return { label: "Mixed conditions", Icon: CloudSun };
};
const fmtDay = (s: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${s}T12:00:00`).toLocaleDateString(undefined, opts);
const fmtHour = (s: string) => new Date(s).toLocaleTimeString(undefined, { hour: "numeric" });
const scoreDay = (w: Weather, i: number) => {
  const code = w.daily.weather_code[i];
  let score = 100;
  if (w.daily.precipitation_probability_max[i] > 60) score -= 30;
  else if (w.daily.precipitation_probability_max[i] > 35) score -= 16;
  if (w.daily.precipitation_sum[i] > 8) score -= 25;
  else if (w.daily.precipitation_sum[i] > 2) score -= 12;
  if ([95, 96, 99, 65, 67, 82, 86].includes(code)) score -= 30;
  if ([45, 48].includes(code)) score -= 12;
  if (w.daily.wind_speed_10m_max[i] > 40) score -= 18;
  else if (w.daily.wind_speed_10m_max[i] > 28) score -= 8;
  const avg = (w.daily.temperature_2m_max[i] + w.daily.temperature_2m_min[i]) / 2;
  if (avg < 4 || avg > 35) score -= 10;
  return Math.max(0, score);
};

export default function Home() {
  const [query, setQuery] = useState("Tokyo");
  const [places, setPlaces] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unit, setUnit] = useState<"c" | "f">("c");
  const [tab, setTab] = useState<"hourly" | "daily">("hourly");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [view, setView] = useState<"weather" | "compare" | "advisor">("weather");
  const [compareQuery, setCompareQuery] = useState("");
  const [comparePlaces, setComparePlaces] = useState<Place[]>([]);
  const [compareSuggestions, setCompareSuggestions] = useState(false);
  const [comparison, setComparison] = useState<{ place: Place; weather: Weather }[]>([]);
  const [compareBusy, setCompareBusy] = useState(false);

  const temp = (n: number) => `${Math.round(unit === "c" ? n : n * 9 / 5 + 32)}°`;
  const wind = (n: number) => `${Math.round(n * (unit === "c" ? 1 : 0.621371))} ${unit === "c" ? "km/h" : "mph"}`;

  async function findPlaces(term: string) {
    if (term.trim().length < 2) { setPlaces([]); return; }
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=6&language=en&format=json`);
      const data = await res.json();
      setPlaces(data.results || []);
      setShowSuggestions(true);
    } catch { setPlaces([]); }
  }

  async function fetchWeather(p: Place): Promise<Weather> {
    const params = new URLSearchParams({
      latitude: String(p.latitude), longitude: String(p.longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
      hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,relative_humidity_2m,wind_speed_10m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunrise,sunset,uv_index_max",
      forecast_days: "16", timezone: "auto"
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) throw new Error(`Could not load the forecast for ${p.name}.`);
    return res.json();
  }

  async function addComparisonPlace(p: Place) {
    if (comparison.some(item => item.place.id === p.id) || comparison.length >= 5) return;
    setCompareBusy(true); setError(""); setCompareSuggestions(false); setComparePlaces([]); setCompareQuery("");
    try {
      const data = await fetchWeather(p);
      setComparison(current => current.some(item => item.place.id === p.id) ? current : [...current, { place: p, weather: data }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load comparison.");
    } finally { setCompareBusy(false); }
  }

  async function searchComparePlaces(term: string) {
    if (term.trim().length < 2) { setComparePlaces([]); return; }
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term)}&count=6&language=en&format=json`);
      const data = await res.json();
      setComparePlaces(data.results || []); setCompareSuggestions(true);
    } catch { setComparePlaces([]); }
  }

  async function loadWeather(p: Place) {
    setBusy(true); setError(""); setPlace(p); setQuery(p.name); setShowSuggestions(false); setPlaces([]);
    try {
      const data = await fetchWeather(p);
      setWeather(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load weather.");
      setWeather(null);
    } finally { setBusy(false); }
  }

  useEffect(() => { findPlaces("Tokyo").then(() => {}); }, []);
  useEffect(() => {
    const t = setTimeout(() => { if (query.trim().length >= 2 && query !== place?.name) findPlaces(query); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => { if (compareQuery.trim().length >= 2) searchComparePlaces(compareQuery); }, 350);
    return () => clearTimeout(t);
  }, [compareQuery]);

  const comparisonRanked = useMemo(() => comparison.map(item => {
    const scores = item.weather.daily.time.slice(0, 7).map((_, i) => scoreDay(item.weather, i));
    return { ...item, averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1)), bestScore: Math.max(...scores) };
  }).sort((a, b) => b.averageScore - a.averageScore), [comparison]);

  const bestDays = useMemo(() => {
    if (!weather) return [];
    return weather.daily.time.map((date, i) => ({ date, i, score: scoreDay(weather, i) }))
      .sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.i - b.i);
  }, [weather]);

  const travelSummary = useMemo(() => {
    if (!weather || bestDays.length === 0) return null;
    const top = bestDays[0];
    const code = codeInfo(weather.daily.weather_code[top.i]).label.toLowerCase();
    return { ...top, code };
  }, [weather, bestDays]);

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    if (places[0]) loadWeather(places[0]);
    else if (query.trim()) findPlaces(query);
  }

  const selectedHourly = weather?.hourly.time.map((time, i) => ({ time, i })).filter(x => new Date(x.time).getTime() >= Date.now()).slice(0, 36) || [];

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><CloudSun size={21}/></span> skyroute</a>
        <div className="top-note"><span className="live-dot"/> WORLD WEATHER & TRAVEL INSIGHTS</div>
        <button className="unit-toggle" onClick={() => setUnit(unit === "c" ? "f" : "c")}>{unit === "c" ? "°C" : "°F"} <ChevronDown size={14}/></button>
      </header>

      <nav className="view-switch" aria-label="Weather views">
        <button className={view === "weather" ? "selected" : ""} onClick={() => setView("weather")}><CloudSun size={15}/> City forecast</button>
        <button className={view === "compare" ? "selected" : ""} onClick={() => setView("compare")}><ArrowLeftRight size={15}/> Compare destinations</button>
        <button className={view === "advisor" ? "selected" : ""} onClick={() => setView("advisor")}><Compass size={15}/> AI Travel Advisor</button>
      </nav>

      {view === "weather" && <>
      <section className="hero">
        <div className="eyebrow"><Compass size={14}/> YOUR WORLD, AT A GLANCE</div>
        <h1>Go where the weather<br/><span>moves you.</span></h1>
        <p className="hero-copy">Explore live conditions, a 15-day outlook, and find a promising window for your next trip.</p>
        <form className="search-wrap" onSubmit={submitSearch}>
          <MapPin size={19} className="search-pin"/>
          <input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => places.length && setShowSuggestions(true)} placeholder="Search any city in the world…" aria-label="Search city"/>
          <button type="submit" className="search-btn" disabled={busy}><Search size={17}/> Explore</button>
          {showSuggestions && places.length > 0 && <div className="suggestions">
            {places.map(p => <button type="button" key={p.id} onClick={() => loadWeather(p)}>
              <MapPin size={15}/><span>{p.name}<small>{[p.admin1, p.country].filter(Boolean).join(", ")}</small></span>
            </button>)}
          </div>}
        </form>
        <div className="search-hint">Try a city, region, or destination · Worldwide coverage</div>
      </section>

      {busy && <div className="loading"><LoaderCircle className="spin" size={22}/> Finding the forecast…</div>}
      {error && <div className="error"><AlertCircle size={18}/>{error}</div>}

      {weather && place && !busy && <>
        <section className="location-line">
          <div><div className="eyebrow">YOUR DESTINATION</div><h2>{place.name}{place.country ? <span>, {place.country}</span> : ""}</h2><p><MapPin size={14}/>{place.admin1 ? `${place.admin1}, ` : ""}{place.country || "World"} <span className="dot-sep">·</span> Local time {new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit", timeZone: weather.timezone }).format(new Date())}</p></div>
          <div className="updated"><span className="live-dot"/> FORECAST UPDATED LIVE</div>
        </section>

        <section className="current-grid">
          <div className="current-card">
            <div className="card-kicker">RIGHT NOW <span>{weather.current?.is_day ? "DAYTIME" : "NIGHTTIME"}</span></div>
            <div className="current-main">
              <div><div className="big-temp">{temp(weather.current?.temperature_2m ?? 0)}</div><div className="condition">{codeInfo(weather.current?.weather_code ?? 0).label}</div><div className="feels">Feels like {temp(weather.current?.apparent_temperature ?? 0)}</div></div>
              {(() => { const Icon = codeInfo(weather.current?.weather_code ?? 0).Icon; return <Icon className="weather-art" size={94} strokeWidth={1.2}/>; })()}
            </div>
            <div className="current-foot"><span><MapPin size={14}/>{place.name}</span><span>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span></div>
          </div>
          <div className="stats-card">
            <div className="stat"><Thermometer/><div><small>FEELS LIKE</small><strong>{temp(weather.current?.apparent_temperature ?? 0)}</strong></div></div>
            <div className="stat"><Droplets/><div><small>HUMIDITY</small><strong>{weather.current?.relative_humidity_2m ?? "—"}%</strong></div></div>
            <div className="stat"><Wind/><div><small>WIND SPEED</small><strong>{wind(weather.current?.wind_speed_10m ?? 0)}</strong></div></div>
            <div className="stat"><Umbrella/><div><small>PRECIPITATION</small><strong>{weather.current?.precipitation ?? 0} mm</strong></div></div>
          </div>
        </section>

        {travelSummary && <section className="travel-card">
          <div className="travel-icon"><Plane size={25}/></div>
          <div className="travel-copy"><div className="eyebrow">SKYROUTE TRAVEL WINDOW</div><h3>Best-looking day: {fmtDay(travelSummary.date, { weekday: "long", day: "numeric", month: "long" })}</h3><p>Among the next 15 days, this day has the strongest weather score — currently {travelSummary.code}, with a high of {temp(weather.daily.temperature_2m_max[travelSummary.i])} and up to {weather.daily.precipitation_probability_max[travelSummary.i]}% precipitation probability.</p><small>Top forecast picks: {bestDays.map(x => fmtDay(x.date, { day: "numeric", month: "short" })).join(" · ")}</small></div>
          <div className="score"><strong>{travelSummary.score}</strong><span> / 100<br/>weather score</span></div>
        </section>}

        <section className="forecast-section">
          <div className="section-heading"><div><div className="eyebrow">PLAN AHEAD</div><h3>Weather forecast</h3></div><div className="tabs"><button className={tab === "hourly" ? "active" : ""} onClick={() => setTab("hourly")}>Hourly</button><button className={tab === "daily" ? "active" : ""} onClick={() => setTab("daily")}>15 days</button></div></div>
          {tab === "hourly" ? <div className="hourly-scroll">
            {selectedHourly.map(({ time, i }) => { const Icon = codeInfo(weather.hourly.weather_code[i]).Icon; return <div className="hour-item" key={time}><span className="hour-time">{i === selectedHourly[0]?.i ? "Now" : fmtHour(time)}</span><Icon size={22}/><strong>{temp(weather.hourly.temperature_2m[i])}</strong><small><Droplets size={12}/>{weather.hourly.precipitation_probability[i] ?? 0}%</small></div>; })}
          </div> : <div className="daily-list">
            {weather.daily.time.slice(0, 16).map((date, i) => { const Icon = codeInfo(weather.daily.weather_code[i]).Icon; const pick = bestDays.some(x => x.i === i); return <div className="day-row" key={date}>
              <span className="day-name">{i === 0 ? "Today" : fmtDay(date)}</span><Icon size={21}/><span className="day-condition">{codeInfo(weather.daily.weather_code[i]).label}</span><span className="day-rain"><Droplets size={13}/>{weather.daily.precipitation_probability_max[i]}%</span><span className="day-temp"><b>{temp(weather.daily.temperature_2m_max[i])}</b><i>{temp(weather.daily.temperature_2m_min[i])}</i></span>{pick && <span className="best-tag">GOOD WINDOW</span>}
            </div>; })}
          </div>}
        </section>

        <section className="daylight-grid">
          <div className="mini-card"><Sunrise/><div><small>SUNRISE</small><strong>{new Date(weather.daily.sunrise[0]).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: weather.timezone })}</strong></div></div>
          <div className="mini-card"><Sunset/><div><small>SUNSET</small><strong>{new Date(weather.daily.sunset[0]).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: weather.timezone })}</strong></div></div>
          <div className="mini-card"><Wind/><div><small>MAX WIND TODAY</small><strong>{wind(weather.daily.wind_speed_10m_max[0])}</strong></div></div>
          <div className="mini-card"><Thermometer/><div><small>UV INDEX MAX</small><strong>{weather.daily.uv_index_max[0]}</strong></div></div>
        </section>
        <p className="disclaimer"><AlertCircle size={14}/> Travel guidance is a simple comparison of forecast conditions over the next 15 days, not a climate-based seasonal recommendation. Weather can change; check again before booking.</p>
      </>}

      {!weather && !busy && !error && <section className="welcome-card"><div className="welcome-illustration"><CloudSun size={54}/></div><h3>Your next destination starts here.</h3><p>Search for a city to see its current conditions, hourly outlook, 15-day forecast, and the most promising weather window.</p><div className="popular"><span>POPULAR DESTINATIONS</span>{["London", "Dubai", "Singapore", "New York", "Sydney"].map(city => <button key={city} onClick={() => { setQuery(city); findPlaces(city).then(() => {}); }}>{city}</button>)}</div></section>}

      </>}

      {view === "advisor" && <TravelAdvisor initialCity={place?.name || ""} unit={unit} />}

      {view === "compare" && <section className="compare-page">
        <div className="compare-hero">
          <div className="eyebrow"><ArrowLeftRight size={14}/> MAKE THE WEATHER PART OF YOUR PLAN</div>
          <h1>Two cities. One<br/><span>better decision.</span></h1>
          <p className="hero-copy">Compare live conditions and the next 7 days across up to five destinations.</p>
          <div className="compare-search-wrap">
            <MapPin size={18}/>
            <input value={compareQuery} onChange={e => setCompareQuery(e.target.value)} onFocus={() => comparePlaces.length && setCompareSuggestions(true)} onKeyDown={e => { if (e.key === "Enter" && comparePlaces[0]) { e.preventDefault(); addComparisonPlace(comparePlaces[0]); } }} placeholder="Add a city to compare…" aria-label="Add city to comparison"/>
            <span className="city-count">{comparison.length}/5 CITIES</span>
            {compareSuggestions && comparePlaces.length > 0 && <div className="suggestions">{comparePlaces.map(p => <button type="button" key={`${p.id}-${p.latitude}`} onClick={() => addComparisonPlace(p)}><MapPin size={15}/><span>{p.name}<small>{[p.admin1, p.country].filter(Boolean).join(", ")}</small></span></button>)}</div>}
          </div>
          <div className="search-hint">Add at least two cities · Search worldwide · Compare up to five</div>
        </div>
        {compareBusy && <div className="loading"><LoaderCircle className="spin" size={22}/> Loading destination forecast…</div>}
        {error && <div className="error"><AlertCircle size={18}/>{error}</div>}
        {comparison.length === 0 && !compareBusy && <div className="welcome-card compare-empty"><div className="welcome-illustration"><ArrowLeftRight size={48}/></div><h3>Your destination shortlist starts here.</h3><p>Add two or more cities above to compare their weather side by side. Try these popular destinations:</p><div className="popular">{["Dubai", "Singapore", "Bangkok", "London", "Bali"].map(city => <button key={city} onClick={() => { setCompareQuery(city); searchComparePlaces(city); }}>{city}</button>)}</div></div>}
        {comparison.length > 0 && <>
          <div className="compare-toolbar"><div><div className="eyebrow">DESTINATION SHORTLIST</div><h2>{comparison.length} {comparison.length === 1 ? "destination" : "destinations"} compared</h2></div><button className="clear-btn" onClick={() => setComparison([])}>Clear all</button></div>
          {comparison.length < 2 && <div className="compare-tip"><Plus size={16}/> Add at least one more city to see which destination has the better forecast.</div>}
          {comparison.length >= 2 && <div className="winner-banner"><div className="winner-icon"><Trophy size={22}/></div><div><div className="eyebrow">BEST FORECAST OUTLOOK · NEXT 7 DAYS</div><strong>{comparisonRanked[0].place.name} is currently looking best</strong><p>Average weather score {comparisonRanked[0].averageScore}/100 across the next 7 days. This is a weather-only comparison, not a complete travel recommendation.</p></div><div className="winner-score">{comparisonRanked[0].averageScore}<small>/100</small></div></div>}
          <div className="comparison-grid">
            {comparisonRanked.map((item, rank) => { const w = item.weather; const c = w.current; const info = codeInfo(c?.weather_code ?? 0); const Icon = info.Icon; const bestIndex = w.daily.time.slice(0, 7).map((_, i) => scoreDay(w, i)).indexOf(item.bestScore); return <article className={`destination-card ${rank === 0 && comparison.length > 1 ? "top-destination" : ""}`} key={item.place.id}>
              <div className="destination-card-head"><div><div className="destination-country">{item.place.country || "DESTINATION"}</div><h3>{item.place.name}</h3><p>{item.place.admin1 || item.place.country || "Worldwide"}</p></div><button className="remove-city" title={`Remove ${item.place.name}`} onClick={() => setComparison(current => current.filter(x => x.place.id !== item.place.id))}><X size={16}/></button></div>
              <div className="destination-current"><div><strong>{temp(c?.temperature_2m ?? 0)}</strong><span>{info.label}</span><small>Feels like {temp(c?.apparent_temperature ?? 0)}</small></div><Icon size={48}/></div>
              <div className="destination-metrics"><div><small>HUMIDITY</small><strong>{c?.relative_humidity_2m ?? "—"}%</strong></div><div><small>WIND</small><strong>{wind(c?.wind_speed_10m ?? 0)}</strong></div><div><small>RAIN NOW</small><strong>{c?.precipitation ?? 0} mm</strong></div></div>
              <div className="destination-score-row"><span>7-day weather score</span><strong>{item.averageScore}<small>/100</small></strong></div><div className="score-track"><span style={{ width: `${item.averageScore}%` }}/></div>
              <div className="best-day-line"><CalendarDays size={14}/><span>Best-looking day: <b>{fmtDay(w.daily.time[bestIndex], { weekday: "short", day: "numeric", month: "short" })}</b></span></div>
              <div className="mini-week">{w.daily.time.slice(0, 7).map((date, i) => { const DayIcon = codeInfo(w.daily.weather_code[i]).Icon; return <div key={date}><small>{fmtDay(date, { weekday: "short" })}</small><DayIcon size={17}/><b>{temp(w.daily.temperature_2m_max[i])}</b><i>{temp(w.daily.temperature_2m_min[i])}</i></div>; })}</div>
              {rank === 0 && comparison.length > 1 && <div className="recommended-tag"><Trophy size={12}/> BEST OUTLOOK</div>}
            </article>; })}
          </div>
          <p className="disclaimer"><AlertCircle size={14}/> Scores are indicative comparisons calculated from the next 7 forecast days using rain probability, rainfall, severe weather, wind and broad temperature comfort thresholds. Forecasts are less certain further out. Check conditions again before booking.</p>
        </>}
      </section>}

      <footer><a className="brand" href="#"><span className="brand-mark"><CloudSun size={17}/></span> skyroute</a><span>Weather data by Open-Meteo · Built for curious travellers</span><span>Forecasts are guidance, not guarantees.</span></footer>
    </main>
  );
}
