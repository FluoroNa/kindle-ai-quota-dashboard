'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CITY = process.env.WEATHER_CITY || 'Guangzhou';
const OUTPUT = path.resolve(process.argv[2] || 'config/weather.json');

const text = execFileSync('curl', ['-s', `wttr.in/${CITY}?format=j1`], {
  encoding: 'utf8', timeout: 15000, maxBuffer: 256 * 1024
});
const data = JSON.parse(text);
const current = data.current_condition[0];
const now = new Date();

const weather = {
  description: String(current.weatherDesc[0].value || current.weatherDesc[0] || '未知'),
  iconKey: iconFromDesc(current.weatherDesc[0].value || ''),
  tempC: Number(current.temp_C),
  feelsLikeC: Number(current.FeelsLikeC),
  humidity: Number(current.humidity),
  windKph: Number(current.windspeedKmph),
  windDir: windDirCn(String(current.winddir16Point || '')),
  place: CITY,
  observedAt: now.toISOString().replace('Z', '+08:00'),
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(weather, null, 2) + '\n', 'utf8');
process.stdout.write(`weather: ${weather.description} ${weather.tempC}°C ${weather.place}\n`);

function iconFromDesc(desc) {
  const t = String(desc).toLowerCase();
  if (t.includes('thunder')) return 'thunder';
  if (t.includes('rain') || t.includes('drizzle')) return 'rain';
  if (t.includes('snow')) return 'snow';
  if (t.includes('fog') || t.includes('mist') || t.includes('haze')) return 'fog';
  if (t.includes('clear') || t.includes('sunny')) return 'clear';
  if (t.includes('overcast')) return 'cloudy';
  return 'cloudy';
}

function windDirCn(dir) {
  const map = { N:'北风', NNE:'东北偏北', NE:'东北风', ENE:'东北偏东',
    E:'东风', ESE:'东南偏东', SE:'东南风', SSE:'东南偏南',
    S:'南风', SSW:'西南偏南', SW:'西南风', WSW:'西南偏西',
    W:'西风', WNW:'西北偏西', NW:'西北风', NNW:'西北偏北' };
  return map[dir.toUpperCase()] || dir;
}
