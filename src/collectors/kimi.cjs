'use strict';

const fs = require('node:fs');
const {
  clampPct,
  expandHome,
  failedWindows,
  fetchJson,
  isoBeijing,
  readJson,
} = require('../lib/common.cjs');

function firstValue(object, keys) {
  for (const key of keys) {
    if (object && object[key] != null) return object[key];
  }
  return null;
}

function windowName(item, detail, index) {
  const explicit = firstValue(item, ['name', 'title', 'scope']) || firstValue(detail, ['name', 'title']);
  if (explicit) return String(explicit);
  const window = item && item.window || {};
  const duration = Number(firstValue(window, ['duration']) || firstValue(item, ['duration']) || firstValue(detail, ['duration']));
  const unit = String(firstValue(window, ['timeUnit']) || firstValue(item, ['timeUnit']) || '');
  if (Number.isFinite(duration)) {
    if (unit.includes('MINUTE') && duration % 60 === 0) return `${duration / 60}小时`;
    if (unit.includes('HOUR')) return `${duration}小时`;
    if (unit.includes('DAY')) return duration === 7 ? '周' : `${duration}天`;
  }
  return `窗口${index + 1}`;
}

function resetAt(item, detail) {
  const raw = firstValue(detail, ['reset_at', 'resetAt', 'reset_time', 'resetTime'])
    || firstValue(item, ['reset_at', 'resetAt', 'reset_time', 'resetTime']);
  if (raw) return isoBeijing(raw);
  const seconds = Number(firstValue(detail, ['reset_in', 'resetIn', 'ttl']) || firstValue(item, ['reset_in', 'resetIn', 'ttl']));
  return Number.isFinite(seconds) && seconds > 0 ? isoBeijing(Date.now() + seconds * 1000) : null;
}

async function collectKimi(config = {}) {
  const fetchedAt = isoBeijing();
  if (!config.enabled) {
    return { ...failedWindows('Kimi', '未启用', fetchedAt), disabled: true };
  }

  // Try API key env var first, then local credentials
  const apiKey = String(process.env.KIMI_API_KEY || '').trim();
  if (apiKey) {
    try {
      const windows = await fetchKimiWindows(apiKey, config);
      return { ok: true, label: 'Kimi', windows, fetchedAt, error: null };
    } catch (error) {
      return failedWindows('Kimi', error, fetchedAt);
    }
  }

  if (config.experimental !== true || config.allowLocalCredentialRead !== true) {
    return failedWindows('Kimi', '必须设置 KIMI_API_KEY 或显式开启 experimental 和 allowLocalCredentialRead', fetchedAt);
  }

  try {
    const credentialsPath = expandHome(config.credentialsFile || '~/.kimi-code/credentials/kimi-code.json');
    const credentials = readJson(credentialsPath);
    const token = String(credentials && credentials.access_token || '').trim();
    if (!token) throw new Error('Kimi Code 登录凭据中没有 access_token');

    try {
      const windows = await fetchKimiWindows(token, config);
      return { ok: true, label: 'Kimi', windows, fetchedAt, error: null };
    } catch (firstError) {
      // Token expired - try refresh
      const refreshToken = String(credentials && credentials.refresh_token || '').trim();
      if (refreshToken) {
        try {
          const newTokens = await refreshKimiToken(refreshToken, credentials);
          if (newTokens) {
            fs.writeFileSync(credentialsPath, JSON.stringify(newTokens, null, 2), 'utf8');
            const windows = await fetchKimiWindows(newTokens.access_token, config);
            return { ok: true, label: 'Kimi', windows, fetchedAt, error: null };
          }
        } catch (refreshError) {
          // Refresh failed, re-throw original error
        }
      }
      throw firstError;
    }
  } catch (error) {
    return failedWindows('Kimi', error, fetchedAt);
  }
}

async function refreshKimiToken(refreshToken, credentials) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: '17e5f671-d194-4dfb-9706-5516cb48c098',
  });
  const endpoints = [
    'https://api.moonshot.cn/oauth/token',
    'https://auth.moonshot.cn/realms/moonshot/protocol/openid-connect/token',
    'https://api.kimi.com/coding/v1/oauth/token',
  ];
  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      });
      if (resp.status === 200) {
        const data = await resp.json();
        if (data.access_token) {
          return {
            ...credentials,
            access_token: data.access_token,
            refresh_token: data.refresh_token || refreshToken,
            expires_at: data.expires_at || credentials.expires_at,
            expires_in: data.expires_in || credentials.expires_in,
          };
        }
      }
    } catch {}
  }
  return null;
}

async function fetchKimiWindows(token, config) {
  const windows = [];
  const baseUrl = String(config.baseUrl || 'https://api.kimi.com/coding/v1').replace(/\/+$/, '');
  const payload = await fetchJson(`${baseUrl}/usages`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const limits = Array.isArray(payload && payload.limits) ? payload.limits : [];
  limits.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const detail = item.detail && typeof item.detail === 'object' ? item.detail : item;
    const limit = Number(detail.limit);
    let used = Number(detail.used);
    if (!Number.isFinite(used) && Number.isFinite(Number(detail.remaining)) && Number.isFinite(limit)) {
      used = limit - Number(detail.remaining);
    }
    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return;
    const modelVal = firstValue(item, ['model', 'model_name', 'modelName'])
      || firstValue(detail, ['model', 'model_name', 'modelName']) || null;
    windows.push({
      name: windowName(item, detail, index),
      usedPct: clampPct(used / limit * 100),
      usedTokens: Math.round(used),
      limitTokens: Math.round(limit),
      model: modelVal ? String(modelVal) : null,
      resetAt: resetAt(item, detail),
    });
  });
  if (payload && payload.usage) {
    const usage = payload.usage;
    const limit = Number(usage.limit);
    const used = Number(usage.used);
    if (Number.isFinite(limit) && limit > 0 && Number.isFinite(used)) {
      windows.push({
        name: '周',
        usedPct: clampPct(used / limit * 100),
        usedTokens: Math.round(used),
        limitTokens: Math.round(limit),
        model: (usage && usage.model) ? String(usage.model) : null,
        resetAt: resetAt(usage, usage),
      });
    }
  }
  if (!windows.length) throw new Error('Kimi usages 响应中没有可识别的额度窗口');
  return windows;
}

module.exports = { collectKimi, resetAt, windowName };
