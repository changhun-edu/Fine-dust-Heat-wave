
// Vercel 서버리스 프록시
// 배포 위치: 프로젝트 루트의 api/proxy.js  →  호출 주소: /api/proxy?url=...
//
// 무료 공개 CORS 프록시(allorigins, corsproxy.io, codetabs, thingproxy)는
// 차단·타임아웃이 잦아 학교 현장에서 수시로 조회가 실패한다.
// 같은 Vercel 프로젝트 안에서 이 함수를 거치면 CORS 문제도, 차단도 사라진다.

// 허용 도메인 — 임의의 주소로 우회 호출되는 것을 막는다
const ALLOW = [
  'apis.data.go.kr',   // 에어코리아, 기상청
  'apihub.kma.go.kr',
  'open.neis.go.kr',   // 학교 검색
];

export default async function handler(req, res) {
  const target = req.query.url;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!target) return res.status(400).json({ error: 'url 파라미터가 없습니다' });

  let host;
  try {
    host = new URL(target).hostname;
  } catch {
    return res.status(400).json({ error: '잘못된 url' });
  }
  if (!ALLOW.some(d => host === d || host.endsWith('.' + d))) {
    return res.status(403).json({ error: '허용되지 않은 도메인: ' + host });
  }

  try {
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'outdoor-activity-dashboard' },
      signal: AbortSignal.timeout(9000),
    });
    const text = await upstream.text();

    // 원본이 JSON이면 그대로, 아니면 문자열로 감싸 전달
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // 같은 값을 여러 학교가 동시에 요청하므로 5분 캐시 — API 호출 한도를 크게 아낀다
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

    try {
      return res.status(upstream.status).send(text);
    } catch {
      return res.status(upstream.status).json({ raw: text });
    }
  } catch (e) {
    return res.status(502).json({ error: '원본 서버 호출 실패: ' + e.message });
  }
}
