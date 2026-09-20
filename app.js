const els = {
  cityInput: document.getElementById('cityInput'),
  searchBtn: document.getElementById('searchBtn'),
  suggestions: document.getElementById('suggestions'),
  locateBtn: document.getElementById('locateBtn'),
  unitC: document.getElementById('unitC'),
  unitF: document.getElementById('unitF'),
  loading: document.getElementById('loading'),
  errorBox: document.getElementById('errorBox'),
  locationName: document.getElementById('locationName'),
  locationMeta: document.getElementById('locationMeta'),
  lastUpdated: document.getElementById('lastUpdated'),
  weatherIcon: document.getElementById('weatherIcon'),
  tempBig: document.getElementById('tempBig'),
  conditionText: document.getElementById('conditionText'),
  feelsLike: document.getElementById('feelsLike'),
  tempRange: document.getElementById('tempRange'),
  isDayBadge: document.getElementById('isDayBadge'),
  humidityVal: document.getElementById('humidityVal'),
  humidityBar: document.getElementById('humidityBar'),
  humidityDesc: document.getElementById('humidityDesc'),
  windVal: document.getElementById('windVal'),
  windDir: document.getElementById('windDir'),
  windArrow: document.getElementById('windArrow'),
  pressureVal: document.getElementById('pressureVal'),
  pressureDesc: document.getElementById('pressureDesc'),
  cloudVal: document.getElementById('cloudVal'),
  cloudDesc: document.getElementById('cloudDesc'),
  precipVal: document.getElementById('precipVal'),
  precipDesc: document.getElementById('precipDesc'),
  sunriseVal: document.getElementById('sunriseVal'),
  sunsetVal: document.getElementById('sunsetVal'),
  alertList: document.getElementById('alertList'),
  alertCount: document.getElementById('alertCount'),
  dailyList: document.getElementById('dailyList'),
  hourlyList: document.getElementById('hourlyList'),
  apiGeo: document.getElementById('apiGeo'),
  apiForecast: document.getElementById('apiForecast'),
  nextRefresh: document.getElementById('nextRefresh'),
};

let unit = localStorage.getItem('atmos_unit') || 'C';
let currentLocation = null; // {name, country, lat, lon, timezone}
let refreshTimer = null;
let countdownTimer = null;
let nextRefreshAt = null;
let chart = null;

// WMO weather codes
const weatherCodes = {
  0:{icon:'☀️',label:'Clear sky'},
  1:{icon:'🌤️',label:'Mainly clear'},
  2:{icon:'⛅',label:'Partly cloudy'},
  3:{icon:'☁️',label:'Overcast'},
  45:{icon:'🌫️',label:'Fog'},
  48:{icon:'🌫️',label:'Depositing rime fog'},
  51:{icon:'🌦️',label:'Light drizzle'},
  53:{icon:'🌦️',label:'Moderate drizzle'},
  55:{icon:'🌧️',label:'Dense drizzle'},
  56:{icon:'🌧️',label:'Light freezing drizzle'},
  57:{icon:'🌧️',label:'Dense freezing drizzle'},
  61:{icon:'🌧️',label:'Slight rain'},
  63:{icon:'🌧️',label:'Moderate rain'},
  65:{icon:'🌧️',label:'Heavy rain'},
  66:{icon:'🌧️',label:'Light freezing rain'},
  67:{icon:'🌧️',label:'Heavy freezing rain'},
  71:{icon:'🌨️',label:'Slight snow'},
  73:{icon:'🌨️',label:'Moderate snow'},
  75:{icon:'❄️',label:'Heavy snow'},
  77:{icon:'❄️',label:'Snow grains'},
  80:{icon:'🌦️',label:'Slight rain showers'},
  81:{icon:'🌧️',label:'Moderate rain showers'},
  82:{icon:'⛈️',label:'Violent rain showers'},
  85:{icon:'🌨️',label:'Slight snow showers'},
  86:{icon:'🌨️',label:'Heavy snow showers'},
  95:{icon:'⛈️',label:'Thunderstorm'},
  96:{icon:'⛈️',label:'Thunderstorm with slight hail'},
  99:{icon:'⛈️',label:'Thunderstorm with heavy hail'},
};
function wmo(code){ return weatherCodes[code] || {icon:'⛅',label:'Unknown'} }

function cToF(c){ return c*9/5+32 }
function fmtTemp(c){
  if(c==null) return '--°';
  const v = unit==='F' ? cToF(c) : c;
  return `${Math.round(v)}°${unit}`;
}
function fmtTempRaw(c){
  const v = unit==='F' ? cToF(c) : c;
  return Math.round(v);
}
function windDirText(deg){
  const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg/22.5)%16] + ` (${Math.round(deg)}°)`;
}

function setUnit(u){
  unit=u;
  localStorage.setItem('atmos_unit',u);
  els.unitC.classList.toggle('active',u==='C');
  els.unitF.classList.toggle('active',u==='F');
  if(currentLocation) fetchWeather(currentLocation);
}
els.unitC.addEventListener('click',()=>setUnit('C'));
els.unitF.addEventListener('click',()=>setUnit('F'));
setUnit(unit);

function showLoading(v){ els.loading.classList.toggle('hidden',!v) }
function showError(msg){
  if(!msg){ els.errorBox.classList.add('hidden'); return; }
  els.errorBox.textContent=msg;
  els.errorBox.classList.remove('hidden');
}

async function geocodeSearch(q){
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`;
  els.apiGeo.textContent=url;
  const res=await fetch(url);
  if(!res.ok) throw new Error('Geocoding failed');
  const data=await res.json();
  return data.results || [];
}

async function geocodeReverse(lat,lon){
  // Use geocoding reverse via open-meteo? fallback to bigdatacloud or just lat/lon
  // We'll try to use open-meteo reverse by searching nearest via lat/lon not available, so use nominatim style
  // Simpler: use open-meteo geocoding with no ideal reverse, so we call a free reverse endpoint
  try{
    const r=await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en`);
    if(r.ok){
      const d=await r.json();
      if(d.results && d.results[0]) return d.results[0];
    }
  }catch{}
  return {name:`${lat.toFixed(2)}, ${lon.toFixed(2)}`, country:'', latitude:lat, longitude:lon, timezone:'auto'};
}

async function fetchWeather(loc){
  showLoading(true); showError('');
  try{
    const lat=loc.latitude, lon=loc.longitude;
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,precipitation,cloud_cover,is_day&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`;
    els.apiForecast.textContent=url;
    const res=await fetch(url);
    if(!res.ok) throw new Error('Forecast fetch failed: '+res.status);
    const data=await res.json();
    renderAll(data, loc);
    currentLocation=loc;
    try{ localStorage.setItem('atmos_last', JSON.stringify(loc)); }catch{}
    scheduleRefresh();
  }catch(e){
    showError(e.message || 'Failed to fetch weather');
  }finally{
    showLoading(false);
  }
}

function renderAll(data, loc){
  const cur=data.current;
  const daily=data.daily;
  const hourly=data.hourly;
  const tz=data.timezone || loc.timezone || 'UTC';
  const liveBadge = loc._live==='gps' ? '📍 Live GPS' : loc._live==='ip' ? '📍 Live (IP)' : '';

  // Header
  els.locationName.textContent = `${loc.name}${loc.country ? ', '+loc.country : ''}` + (liveBadge ? `  ${liveBadge}` : '');
  els.locationMeta.textContent = `${loc.latitude.toFixed(3)}°, ${loc.longitude.toFixed(3)}° • ${tz}` + (liveBadge ? ` • ${liveBadge}` : '');
  const updated = new Date(cur.time);
  els.lastUpdated.textContent = `Updated: ${updated.toLocaleString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true, month:'short', day:'numeric'})} • ${tz}` + (liveBadge ? ' • Live' : '');

  const codeInfo=wmo(cur.weather_code);
  els.weatherIcon.textContent=codeInfo.icon;
  els.tempBig.textContent=fmtTemp(cur.temperature_2m);
  els.conditionText.textContent=codeInfo.label;
  els.feelsLike.textContent=`Feels like ${fmtTemp(cur.apparent_temperature)} • Wind ${Math.round(cur.wind_speed_10m)} km/h`;
  const tMax=daily.temperature_2m_max[0], tMin=daily.temperature_2m_min[0];
  els.tempRange.textContent=`H ${fmtTemp(tMax)} • L ${fmtTemp(tMin)}`;
  els.isDayBadge.textContent=cur.is_day ? '☀ Daytime' : '🌙 Nighttime';

  // Stats
  els.humidityVal.textContent=cur.relative_humidity_2m+'%';
  els.humidityBar.style.width=cur.relative_humidity_2m+'%';
  els.humidityDesc.textContent= cur.relative_humidity_2m>70 ? 'High humidity' : cur.relative_humidity_2m>40 ? 'Comfortable' : 'Dry air';
  els.windVal.textContent=Math.round(cur.wind_speed_10m)+' km/h';
  els.windDir.textContent=windDirText(cur.wind_direction_10m);
  els.windArrow.style.transform=`rotate(${cur.wind_direction_10m}deg)`;
  els.pressureVal.textContent=Math.round(cur.pressure_msl)+' hPa';
  els.pressureDesc.textContent=cur.pressure_msl>1015 ? 'High pressure' : cur.pressure_msl<1005 ? 'Low pressure' : 'Normal';
  els.cloudVal.textContent=cur.cloud_cover+'%';
  els.cloudDesc.textContent=cur.cloud_cover>70?'Overcast':cur.cloud_cover>40?'Partly cloudy':'Clear';
  els.precipVal.textContent=cur.precipitation+' mm';
  els.precipDesc.textContent=cur.precipitation>0 ? 'Active precipitation' : 'No precipitation';
  const sunrise=new Date(daily.sunrise[0]), sunset=new Date(daily.sunset[0]);
  els.sunriseVal.textContent='↑ '+sunrise.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  els.sunsetVal.textContent='↓ '+sunset.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})+' Sunset';

  // Alerts logic
  renderAlerts(cur, daily);

  // Daily
  renderDaily(daily);

  // Hourly list + chart
  renderHourly(hourly, cur.time);
}

function renderAlerts(cur, daily){
  const alerts=[];
  if(cur.wind_speed_10m >= 30) alerts.push({level:'danger', icon:'💨', title:'High Wind Alert', desc:`Wind speed ${Math.round(cur.wind_speed_10m)} km/h — secure loose objects and avoid high exposed areas.`});
  else if(cur.wind_speed_10m >= 20) alerts.push({level:'warn', icon:'🍃', title:'Moderate Wind', desc:`Wind ${Math.round(cur.wind_speed_10m)} km/h — breezy conditions.`});
  if(cur.temperature_2m >= 35) alerts.push({level:'danger', icon:'🔥', title:'Heat Alert', desc:`Temperature ${Math.round(cur.temperature_2m)}°C — stay hydrated and avoid prolonged sun exposure.`});
  if(cur.temperature_2m <= 0) alerts.push({level:'warn', icon:'❄️', title:'Freezing Alert', desc:`Temperature ${Math.round(cur.temperature_2m)}°C — risk of icy surfaces.`});
  if(cur.precipitation >= 10) alerts.push({level:'danger', icon:'🌧️', title:'Heavy Precipitation', desc:`${cur.precipitation} mm precipitation — possible flooding or reduced visibility.`});
  else if(cur.precipitation > 0) alerts.push({level:'info', icon:'🌦️', title:'Precipitation Active', desc:`Light precipitation ${cur.precipitation} mm detected.`});
  if(cur.relative_humidity_2m >= 90) alerts.push({level:'info', icon:'💧', title:'High Humidity', desc:`Humidity ${cur.relative_humidity_2m}% — muggy conditions, possible fog.`});
  // daily wind max
  const maxWind = Math.max(...daily.wind_speed_10m_max);
  if(maxWind>=40 && !alerts.some(a=>a.title.includes('Wind'))) alerts.push({level:'warn', icon:'⚡', title:'Upcoming High Winds', desc:`Forecast peak wind ${Math.round(maxWind)} km/h in next 7 days.`});
  const maxPrecip = Math.max(...daily.precipitation_sum);
  if(maxPrecip>=20) alerts.push({level:'warn', icon:'🌊', title:'Heavy Rain Forecast', desc:`Up to ${maxPrecip} mm rain expected in 7-day forecast.`});

  els.alertCount.textContent=alerts.length;
  if(alerts.length===0){
    els.alertList.innerHTML='<div class="alert empty"><span class="alert-icon">✓</span><div><b>All clear</b><br>No active alerts. Conditions are normal.</div></div>';
  }else{
    els.alertList.innerHTML=alerts.map(a=>`
      <div class="alert ${a.level}">
        <span class="alert-icon">${a.icon}</span>
        <div><b>${a.title}</b><br>${a.desc}</div>
      </div>
    `).join('');
  }
}

function renderDaily(daily){
  const today=new Date();
  // find min/max for bar scaling
  const allMax=daily.temperature_2m_max, allMin=daily.temperature_2m_min;
  const overallMin=Math.min(...allMin), overallMax=Math.max(...allMax), range=overallMax-overallMin || 1;
  els.dailyList.innerHTML=daily.time.map((dateStr,i)=>{
    const d=new Date(dateStr);
    const isToday=i===0;
    const dayLabel=isToday?'Today': d.toLocaleDateString('en-US',{weekday:'short'});
    const code=wmo(daily.weather_code[i]);
    const tmax=fmtTempRaw(daily.temperature_2m_max[i]), tmin=fmtTempRaw(daily.temperature_2m_min[i]);
    const leftPct=((allMin[i]-overallMin)/range)*100;
    const widthPct=((allMax[i]-allMin[i])/range)*100;
    // bar position: we simplify to full bar with fill proportional
    return `
      <div class="daily-item">
        <div class="daily-day">${dayLabel}</div>
        <div class="daily-icon" title="${code.label}">${code.icon}</div>
        <div class="daily-bar" title="Min ${tmin}° / Max ${tmax}°">
          <div class="daily-bar-fill" style="width:${ 60 + (allMax[i]-overallMin)/range*40 }%"></div>
        </div>
        <div class="daily-temps"><span>${tmax}°</span><span class="min">${tmin}°</span></div>
        <div class="daily-precip">${daily.precipitation_sum[i] ? daily.precipitation_sum[i]+' mm' : '—'}</div>
      </div>
    `;
  }).join('');
}

function renderHourly(hourly, currentTimeStr){
  const curHour = currentTimeStr.slice(0,13); // "YYYY-MM-DDTHH"
  // find index of current hour
  let startIdx = hourly.time.findIndex(t=>t.slice(0,13)===curHour);
  if(startIdx<0) startIdx=0;
  const slice = 24;
  const labels=[], temps=[], precip=[];
  const listItems=[];
  for(let i=startIdx;i<Math.min(startIdx+slice, hourly.time.length); i++){
    const d=new Date(hourly.time[i]);
    const label=d.toLocaleTimeString('en-US',{hour:'2-digit',hour12:false}) + ':00';
    labels.push(d.toLocaleTimeString('en-US',{hour:'numeric',hour12:true}));
    const t = unit==='F' ? cToF(hourly.temperature_2m[i]) : hourly.temperature_2m[i];
    temps.push(Math.round(t));
    precip.push(hourly.precipitation_probability[i] ?? 0);
    const isNow=i===startIdx;
    const code=wmo(hourly.weather_code[i]);
    listItems.push(`
      <div class="hourly-item ${isNow?'now':''}">
        <div class="hourly-time">${isNow?'Now': d.toLocaleTimeString('en-US',{hour:'numeric',hour12:true})}</div>
        <div class="hourly-icon">${code.icon}</div>
        <div class="hourly-temp">${Math.round(t)}°</div>
        <div class="hourly-wind">${Math.round(hourly.wind_speed_10m[i])} km/h</div>
        <div class="hourly-wind" style="color:#7dd3fc">${precip[precip.length-1]}% 💧</div>
      </div>
    `);
  }
  els.hourlyList.innerHTML=listItems.join('');

  // Chart
  const ctx=document.getElementById('hourlyChart');
  if(chart) chart.destroy();
  chart=new Chart(ctx,{
    type:'line',
    data:{
      labels,
      datasets:[
        {
          label:'Temperature',
          data:temps,
          borderColor:'#5b8def',
          backgroundColor:(ctx)=>{
            const g=ctx.chart.ctx.createLinearGradient(0,0,0,180);
            g.addColorStop(0,'rgba(91,141,239,0.35)');
            g.addColorStop(1,'rgba(91,141,239,0)');
            return g;
          },
          fill:true,
          tension:0.4,
          pointRadius:0,
          pointHoverRadius:6,
          borderWidth:2.5,
          yAxisID:'y'
        },
        {
          label:'Precip %',
          data:precip,
          borderColor:'#34d399',
          backgroundColor:'rgba(52,211,153,0.12)',
          fill:false,
          tension:0.3,
          pointRadius:0,
          borderWidth:1.8,
          borderDash:[6,4],
          yAxisID:'y1'
        }
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{display:false},
        tooltip:{
          backgroundColor:'#0f1933',
          titleColor:'#cbd5ff',
          bodyColor:'#eef2ff',
          borderColor:'rgba(255,255,255,0.1)',
          borderWidth:1,
          padding:10,
          callbacks:{
            label:(c)=> ` ${c.dataset.label}: ${c.parsed.y}${c.dataset.yAxisID==='y'?'°':'%'}`
          }
        }
      },
      scales:{
        x:{grid:{display:false,color:'rgba(255,255,255,0.06)'},ticks:{color:'#7a85a8',maxRotation:0,autoSkip:true,maxTicksLimit:8,font:{size:11}},border:{display:false}},
        y:{position:'left',grid:{color:'rgba(255,255,255,0.06)'},ticks:{color:'#7a85a8',font:{size:11},callback:v=>v+'°'},border:{display:false}},
        y1:{position:'right',min:0,max:100,grid:{display:false},ticks:{color:'#6ee7b7',font:{size:11},callback:v=>v+'%'},border:{display:false}}
      }
    }
  });
}

// Search handling
let debounceTimer=null;
els.cityInput.addEventListener('input',()=>{
  const q=els.cityInput.value.trim();
  if(q.length<2){ els.suggestions.classList.add('hidden'); return; }
  clearTimeout(debounceTimer);
  debounceTimer=setTimeout(async()=>{
    try{
      const results=await geocodeSearch(q);
      if(results.length===0){
        els.suggestions.innerHTML='<div class="sugg-item" style="color:var(--muted)">No results</div>';
        els.suggestions.classList.remove('hidden');
        return;
      }
      els.suggestions.innerHTML=results.map(r=>`
        <div class="sugg-item" data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${r.name}" data-country="${r.country||''}" data-tz="${r.timezone||'auto'}">
          <span><b>${r.name}</b> ${r.admin1?','+r.admin1:''} ${r.country?'• '+r.country:''}</span>
          <small>${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)}</small>
        </div>
      `).join('');
      els.suggestions.classList.remove('hidden');
      els.suggestions.querySelectorAll('.sugg-item').forEach(el=>{
        el.addEventListener('click',()=>{
          const loc={name:el.dataset.name,country:el.dataset.country,latitude:parseFloat(el.dataset.lat),longitude:parseFloat(el.dataset.lon),timezone:el.dataset.tz};
          els.suggestions.classList.add('hidden');
          els.cityInput.value=loc.name;
          fetchWeather(loc);
        });
      });
    }catch{}
  },350);
});

els.searchBtn.addEventListener('click',async()=>{
  const q=els.cityInput.value.trim();
  if(!q) return;
  const results=await geocodeSearch(q);
  if(results.length){ 
    const r=results[0];
    fetchWeather({name:r.name,country:r.country||'',latitude:r.latitude,longitude:r.longitude,timezone:r.timezone||'auto'});
    els.suggestions.classList.add('hidden');
  } else {
    showError('City not found. Try another name.');
  }
});
els.cityInput.addEventListener('keydown',e=>{
  if(e.key==='Enter') els.searchBtn.click();
  if(e.key==='Escape') els.suggestions.classList.add('hidden');
});
document.addEventListener('click',e=>{
  if(!e.target.closest('.search-wrap')) els.suggestions.classList.add('hidden');
});

// Live location handling — GPS + IP fallback
async function fetchIPLocation(){
  try{
    const r=await fetch('https://ipapi.co/json/');
    if(r.ok){
      const j=await r.json();
      if(j.latitude && j.longitude) return {name:j.city||'My Location', country:j.country_name||j.country||'', latitude:parseFloat(j.latitude), longitude:parseFloat(j.longitude), timezone:j.timezone||'auto'};
    }
  }catch{}
  try{
    const r=await fetch('https://ipwho.is/');
    if(r.ok){
      const j=await r.json();
      if(j.success && j.latitude) return {name:j.city||'My Location', country:j.country||'', latitude:j.latitude, longitude:j.longitude, timezone:j.timezone?.id||'auto'};
    }
  }catch{}
  return null;
}

function requestLiveLocation({silent=false}={}){
  return new Promise(async (resolve)=>{
    // 1) Try browser GPS (secure context: localhost / https)
    if(navigator.geolocation){
      const opts={enableHighAccuracy:true, timeout:8000, maximumAge:60000};
      navigator.geolocation.getCurrentPosition(async pos=>{
        try{
          const lat=pos.coords.latitude, lon=pos.coords.longitude;
          const rev=await geocodeReverse(lat,lon);
          const loc={name:rev.name||'My Location', country:rev.country||'', latitude:lat, longitude:lon, timezone:rev.timezone||'auto', _live:'gps'};
          els.cityInput.value=loc.name;
          if(!silent) showError('');
          await fetchWeather(loc);
          resolve(loc);
        }catch(e){ resolve(null); }
      }, async err=>{
        if(!silent) console.warn('GPS denied:', err.message);
        // fallback to IP
        const ipLoc=await fetchIPLocation();
        if(ipLoc){
          ipLoc._live='ip';
          els.cityInput.value=ipLoc.name;
          await fetchWeather(ipLoc);
          if(!silent) showError('');
          resolve(ipLoc);
        }else{
          if(!silent) showError('Live location denied: '+err.message+' — Enable location permission or use Search.');
          resolve(null);
        }
      }, opts);
    }else{
      const ipLoc=await fetchIPLocation();
      if(ipLoc){
        ipLoc._live='ip';
        els.cityInput.value=ipLoc.name;
        await fetchWeather(ipLoc);
        resolve(ipLoc);
      }else{
        if(!silent) showError('Geolocation not supported in this browser.');
        resolve(null);
      }
    }
    // safety timeout: if GPS hangs, fallback after 9s
    setTimeout(async ()=>{
      // if still loading and no location, try IP
      if(!currentLocation){
        const ipLoc=await fetchIPLocation();
        if(ipLoc && !currentLocation){
          ipLoc._live='ip';
          els.cityInput.value=ipLoc.name;
          await fetchWeather(ipLoc);
          resolve(ipLoc);
        }
      }
    }, 9000);
  });
}

els.locateBtn.addEventListener('click',async()=>{
  els.locateBtn.textContent='◉ Locating…';
  showLoading(true);
  const loc=await requestLiveLocation({silent:false});
  showLoading(false);
  els.locateBtn.textContent='◎ Locate';
  if(!loc) showError('Could not get live location. Please allow location permission (🔒 in address bar) or search a city.');
});

// Auto refresh
function scheduleRefresh(){
  clearInterval(refreshTimer);
  clearInterval(countdownTimer);
  nextRefreshAt=Date.now()+5*60*1000;
  refreshTimer=setInterval(()=>{
    if(currentLocation) fetchWeather(currentLocation);
  },5*60*1000);
  countdownTimer=setInterval(()=>{
    const diff=Math.max(0, nextRefreshAt-Date.now());
    const m=Math.floor(diff/60000), s=Math.floor((diff%60000)/1000);
    els.nextRefresh.textContent=`next refresh in ${m}:${String(s).padStart(2,'0')}`;
    if(diff<=0) els.nextRefresh.textContent='refreshing…';
  },1000);
}

// Init: LIVE LOCATION first, then last location, then Tokyo
(async()=>{
  showLoading(true);
  els.locationName.textContent='Detecting live location…';
  els.locationMeta.textContent='Requesting GPS permission… Please Allow when prompted 🔒';
  // 1) Try live GPS/IP immediately (auto mode)
  const live=await requestLiveLocation({silent:true});
  if(live){ showLoading(false); return; }
  // 2) Fallback: last location
  const last=localStorage.getItem('atmos_last');
  if(last){
    try{ const loc=JSON.parse(last); els.cityInput.value=loc.name; await fetchWeather(loc); showLoading(false); return; }catch{}
  }
  // 3) Fallback: Tokyo
  els.cityInput.value='Tokyo';
  try{
    const results=await geocodeSearch('Tokyo');
    if(results.length){
      const r=results[0];
      await fetchWeather({name:r.name,country:r.country,latitude:r.latitude,longitude:r.longitude,timezone:r.timezone});
    }
  }catch{}
  showLoading(false);
  // hint about live location
  setTimeout(()=> showError('Tip: Click "◎ Locate" to show live weather for your current location. Allow location permission when prompted.'), 1200);
})();

// last location now saved directly inside fetchWeather
