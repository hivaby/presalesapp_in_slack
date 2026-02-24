// Product Knowledge Bank - Google Sheets 기반 제품 정보 지식 뱅크
// 5개 시트 통합: 제품정보, 운영계획, 제어모듈, 제품모듈, 임시(CAD S/W 구분 목적)

const SPREADSHEET_ID = '1xF0RLe_RLjgS52ZSG1buc2TdbczI0r1hnad64ngtgDc';
const MODULE_SPREADSHEET_ID = '1sB-fhoSu3tsIUF5mQVsrKQc4bN-s_3-X2F2aoHFf9BU';
const SHEET_PRODUCT = '제품정보 및 현황';
const SHEET_OPERATION = '운영계획';
const SHEET_CONTROL_MODULE = '제어모듈';
const SHEET_PRODUCT_MODULE = '제품모듈';
const SHEET_CAD_TEMP = '임시(CAD S/W 구분 목적)';

// ─── Google Sheets API 호출 (Service Account JWT) ───
async function fetchSheetData(spreadsheetId, range, serviceAccountJson) {
  try {
    const sa = typeof serviceAccountJson === 'string'
      ? JSON.parse(serviceAccountJson)
      : serviceAccountJson;
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const payload = btoa(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, iat: now
    })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const unsigned = `${header}.${payload}`;
    const crypto = await import('node:crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsigned);
    const signature = sign.sign(sa.private_key, 'base64url');
    const jwt = `${unsigned}.${signature}`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    if (!tokenRes.ok) { console.error('[KB] Token error:', await tokenRes.text()); return null; }
    const { access_token } = await tokenRes.json();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!res.ok) { console.error('[KB] Sheets API error:', await res.text()); return null; }
    const data = await res.json();
    return data.values || [];
  } catch (e) { console.error('[KB] Fetch error:', e.message); return null; }
}

// ─── 제품정보 시트 파싱 ───
function parseProducts(rows) {
  const products = [];
  let currentCategory = '';
  for (const row of rows) {
    const cat = row[1]?.trim();
    const name = row[2]?.trim();
    if (cat) currentCategory = cat;
    if (!name) continue;
    products.push({
      category: currentCategory, name,
      version: row[3]?.trim() || '',
      funcSpec: row[4]?.trim() || '',
      manual: row[5]?.trim() || '',
      preSurvey: row[6]?.trim() || '',
      hwSpec: row[7]?.trim() || '',
      serverEnv: row[8]?.trim() || '',
      clientEnv: row[9]?.trim() || '',
      appSupport: row[10]?.trim() || '',
      cadSupport: row[11]?.trim() || '',
      browserSupport: row[12]?.trim() || '',
      integration: row[13]?.trim() || '',
      note: row[14]?.trim() || ''
    });
  }
  return products;
}

// ─── 운영계획 시트 파싱 ───
function parseOperationPlan(rows) {
  const managers = [];
  const guidelines = [];
  for (const row of rows) {
    const text = (row[1] || '') + ' ' + (row[2] || '');
    if (text.includes('구분') && text.includes('정') && text.includes('부')) continue;
    if (text.includes('소속') && text.includes('성명')) continue;
    const c2 = row[2]?.trim() || '';
    if (c2 && row[3] && row[4]) {
      managers.push({
        division: c2,
        primary: { dept: row[3]?.trim(), name: row[4]?.trim() },
        secondary: { dept: row[5]?.trim() || '', name: row[6]?.trim() || '' },
        note: row[7]?.trim() || ''
      });
    }
    const t = text.trim();
    if (t && !t.startsWith('구분') && t.length > 5) guidelines.push(t);
  }
  return { managers, guidelines };
}

// ─── 제어모듈 시트 파싱 (특수 어플리케이션 + CAD 상세) ───
function parseControlModules(rows) {
  const modules = [];
  for (const row of rows) {
    const product = row[0]?.trim() || '';
    const appType = row[1]?.trim() || '';
    const appName = row[2]?.trim() || '';
    if (!appType || appType === '어플리케이션 종류') continue;
    modules.push({
      product, appType, appName,
      versions: row[3]?.trim() || '',
      exeFile: row[4]?.trim() || '',
      platform: row[5]?.trim() || '',
      moduleName: row[6]?.trim() || '',
      team: row[7]?.trim() || '',
      developer: row[8]?.trim() || '',
      extensions: row[9]?.trim() || '',
      features: {
        usageLog: row[10]?.trim() || '',
        viewCount: row[11]?.trim() || '',
        printCount: row[12]?.trim() || '',
        autoEncrypt: row[13]?.trim() || '',
        secureClipboard: row[15]?.trim() || '',
        securePrint: row[16]?.trim() || '',
        watermark: row[17]?.trim() || '',
        captureBlock: row[18]?.trim() || ''
      },
      note: row[20]?.trim() || ''
    });
  }
  return modules;
}

// ─── 제품모듈 시트 파싱 (서버사이드 모듈, 빌드환경, OS지원) ───
function parseProductModules(rows) {
  const modules = [];
  let currentProduct = '';
  for (const row of rows) {
    const prod = row[0]?.trim() || '';
    if (prod) currentProduct = prod;
    const moduleName = row[2]?.trim() || '';
    if (!moduleName || moduleName === '모듈명') continue;
    modules.push({
      product: currentProduct,
      version: row[1]?.trim() || '',
      moduleName: moduleName.replace(/\n/g, ', '),
      moduleVersion: row[3]?.trim() || '',
      supportOS: (row[4]?.trim() || '').replace(/\n/g, ', '),
      platform: (row[5]?.trim() || '').replace(/[\n\r]/g, ', '),
      buildEnv: row[6]?.trim() || '',
      team: row[7]?.trim() || '',
      developer: row[8]?.trim() || '',
      description: row[9]?.trim() || '',
      gitPath: row[10]?.trim() || ''
    });
  }
  return modules;
}

// ─── 임시(CAD S/W 구분 목적) 시트 파싱 (고객수 포함 상세 CAD 데이터) ───
function parseCadTempSheet(rows) {
  const entries = [];
  for (const row of rows) {
    const appType = row[1]?.trim() || '';
    const appName = row[2]?.trim() || '';
    if (!appType || appType === '어플리케이션 종류') continue;
    entries.push({
      product: row[0]?.trim() || '',
      appType, appName,
      customerCount: row[3]?.trim() || '',
      versions: (row[4]?.trim() || '').replace(/\n/g, ' '),
      exeFile: (row[5]?.trim() || '').replace(/\n/g, ', '),
      platform: row[6]?.trim() || '',
      moduleName: (row[7]?.trim() || '').replace(/\n/g, ', '),
      team: row[8]?.trim() || '',
      developer: row[9]?.trim() || '',
      extensions: row[10]?.trim() || '',
      features: {
        usageLog: row[11]?.trim() || '',
        viewCount: row[12]?.trim() || '',
        printCount: row[13]?.trim() || '',
        autoEncrypt: row[14]?.trim() || '',
        secureClipboard: row[16]?.trim() || '',
        securePrint: row[17]?.trim() || '',
        watermark: row[18]?.trim() || '',
        captureBlock: row[19]?.trim() || ''
      },
      gitPath: row[20]?.trim() || '',
      note: row[21]?.trim() || ''
    });
  }
  return entries;
}

// ─── 어플리케이션 종류 분류 체계 ───
const APP_TYPE_MAP = {
  '01_Core': '코어 모듈',
  '01_Tools': '도구',
  '01_utility': '유틸리티',
  '02_OA _MS-Office': 'OA (MS Office)',
  '02_OA_Haancom-Office': 'OA (한컴오피스)',
  '02_OA_Others': 'OA (기타)',
  '02_OA_PDF': 'OA (PDF)',
  '03_CAD_AutoDesk': 'CAD (AutoDesk)',
  '03_CAD_CATIA': 'CAD (CATIA)',
  '03_CAD_Others': 'CAD (기타)',
  '03_CAD_SolidWorks': 'CAD (SolidWorks)',
  '03_CAD': 'CAD',
  '04_Graphics': '그래픽',
  '05_Staticstics': '통계',
  '06_Site_Custom_App.': '사이트 커스텀',
  '08_others': '기타'
};

// ─── 제품명 매핑 ───
const PRODUCT_NAME_MAP = {
  '01_Document SAFER': 'Document SAFER',
  '02_Print SAFER': 'Print SAFER',
  '03_Privacy SAFER': 'Privacy SAFER',
  '04_Screen SAFER': 'Screen SAFER',
  '05_Cowork SAFER': 'Cowork SAFER',
  '06_QDRM': 'QDRM',
  '10_Mail SAFER': 'Mail SAFER',
  '11_FileServer SAFER': 'FileServer SAFER',
  '12_Others': '기타 모듈'
};

// ─── 검색 스코어링 ───
function productToText(p) {
  return [p.category, p.name, p.version, p.serverEnv, p.clientEnv,
    p.appSupport, p.cadSupport, p.browserSupport, p.integration, p.note
  ].filter(Boolean).join(' ').toLowerCase();
}

const PRODUCT_ALIASES = {
  'document safer': ['docsafer', '문서보안', 'document drm', 'ds', '디에스'],
  'privacy safer': ['개인정보', 'privacy', '프라이버시'],
  'print safer': ['printsafer', '인쇄보안', '프린트', '출력보안'],
  'screen safer': ['screensafer', '화면캡처', '스크린', '화면보안'],
  'web safer': ['websafer', '웹보안', '웹drm'],
  'cowork safer': ['coworksafer', '협업', '코워크'],
  'mobile docs': ['모바일문서', '모바일독스'],
  'mobile safer': ['모바일보안', '모바일세이퍼'],
  'mobile sticker': ['모바일스티커', '스티커'],
  'mobile capture safer': ['모바일캡처', '캡처보안'],
  'iscreen safer': ['아이스크린', 'iscreen'],
  '국방모바일보안': ['국방', '군', '국방모바일'],
  'document safer i/f(server)': ['서버drm', '서버인터페이스', 'server drm', '서버연동'],
  'document safer i/f(client)': ['클라이언트drm', '클라이언트인터페이스'],
  'safepc': ['safepc', 'dlp', '데이터유출', '정보유출', 'safepc enterprise'],
  'safeusb': ['safeusb', 'usb보안', 'usb'],
  'epage safer': ['epagesafer', 'epage', '전자문서', '이페이지'],
  'voicebarcode': ['보이스바코드', '음성바코드'],
  'epage safer for web drm': ['epage web', '이페이지웹'],
  'eps documentmerger': ['문서병합', 'documentmerger'],
  'eps document dna': ['문서dna', 'document dna'],
  'tracer sdk for screen': ['tracer screen', '트레이서스크린', '화면추적'],
  'tracer sdk for print': ['tracer print', '트레이서프린트', '출력추적'],
  'tracer sdk for web': ['tracer web', '트레이서웹'],
  'tracer sdk for mobile': ['tracer mobile', '트레이서모바일'],
  'macrypto': ['macrypto', 'kcmvp', '암호모듈', '마크립토'],
  'es safer': ['essafer', 'es safer', '이에스세이퍼'],
  'fileserver safer': ['파일서버', 'fileserver', 'fss'],
  'mail safer': ['메일보안', 'mailsafer', '메일세이퍼'],
  'qdrm': ['qdrm', '큐디알엠'],
  'zwcad': ['zwcad', '지더블유캐드', 'zw캐드', 'zwcad full', 'zwcad lt'],
  'solidworks': ['솔리드웍스', '솔리드워크스', 'sldworks', 'edrawings'],
  'cadian': ['캐디안', 'cadian'],
  'revit': ['레빗', 'revit', '오토데스크 레빗'],
  'autovue': ['오토뷰', 'autovue', '오라클 오토뷰']
};

const FIELD_KEYWORDS = {
  appSupport: ['어플리케이션', '특수어플리케이션', '특수 어플리케이션', '특수oa', 'application',
    'office', 'hwp', 'pdf', '한글', '오피스', '지원범위', '지원 범위', '특수앱', '특수 앱',
    '지원 어플', '지원어플', '어플 지원', '앱 지원', '앱지원', '특수 프로그램'],
  cadSupport: ['cad', '캐드', 'autocad', 'solidworks', 'catia', 'creo', 'inventor',
    '카티아', '인벤터', '크레오', 'orcad', 'allegro', 'zwcad', 'cadian', '캐디안', 'revit', '레빗', 'autovue', '솔리드웍스'],
  browserSupport: ['브라우저', '크롬', 'chrome', 'edge', 'firefox', 'whale', '웨일', 'browser'],
  serverEnv: ['서버환경', '서버 환경', 'os', 'was', 'db', 'jdk', 'tomcat', 'oracle', 'mariadb', '서버스펙'],
  clientEnv: ['사용자환경', '클라이언트', 'windows', '윈도우', 'mac', 'android', 'ios', '모바일환경'],
  integration: ['연동', '시스템연동', '인터페이스', 'interface', '연동시스템'],
  module: ['모듈', 'module', 'dll', 'exe', '빌드', 'build', '서버모듈', '데몬', 'daemon', 'cipher', '암복호화'],
  developer: ['담당자', '담당', '개발자', '누구', '연락처', '문의', '팀']
};

function scoreProduct(product, query) {
  const searchText = productToText(product);
  const q = query.toLowerCase()
    .replace(/(은|는|이|가|을|를|의|에|로|으로|하다|해줘|알려줘|설명해줘|뭐야|뭐에요|있나요|있어요)\b/g, '')
    .trim();
  const keywords = q.split(/\s+/).filter(k => k.length > 1);
  let score = 0;
  for (const kw of keywords) {
    if (product.name.toLowerCase().includes(kw)) score += 50;
    if (product.category.toLowerCase().includes(kw)) score += 30;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = (searchText.match(new RegExp(escaped, 'g')) || []).length;
    score += matches * 5;
  }
  for (const [name, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (product.name.toLowerCase().includes(name)) {
      for (const alias of aliases) { if (q.includes(alias)) score += 40; }
    }
  }
  for (const [field, fkws] of Object.entries(FIELD_KEYWORDS)) {
    if (fkws.some(k => q.includes(k)) && product[field]) score += 30;
  }

  // CAD/어플리케이션 질의 시, 해당 필드에 실제 데이터가 있는 제품 대폭 부스트
  const isCadQuery = FIELD_KEYWORDS.cadSupport.some(k => q.includes(k));
  const isAppQuery = FIELD_KEYWORDS.appSupport.some(k => q.includes(k));
  if (isCadQuery && product.cadSupport && product.cadSupport !== 'N/A' && product.cadSupport.length > 5) {
    score += 80;
  }
  if (isAppQuery && product.appSupport && product.appSupport !== 'N/A' && product.appSupport.length > 5) {
    score += 80;
  }
  // DRM 카테고리 질의 시 DRM 제품군 카테고리 부스트
  if (q.includes('drm') && product.category.includes('DRM')) {
    score += 60;
  }

  return score;
}

function scoreModule(mod, query) {
  const q = query.toLowerCase()
    .replace(/(은|는|이|가|을|를|의|에|로|으로|하다|해줘|알려줘|설명해줘|뭐야|뭐에요|있나요|있어요)\b/g, '')
    .trim();
  const keywords = q.split(/\s+/).filter(k => k.length > 1);
  let score = 0;
  const text = [mod.appType, mod.appName, mod.versions, mod.extensions, mod.note]
    .filter(Boolean).join(' ').toLowerCase();
  for (const kw of keywords) {
    if (mod.appName.toLowerCase().includes(kw)) score += 50;
    if (text.includes(kw)) score += 10;
  }
  const appTypeKeywords = {
    '03_CAD': ['cad', '캐드', 'autocad', 'catia', 'creo', 'inventor', 'solidworks', 'orcad', 'allegro', 'zwcad', 'cadian', 'revit', 'autovue'],
    '02_OA': ['oa', '오피스', 'office', 'hwp', '한글', 'excel', 'word', 'powerpoint', 'pdf'],
    '04_Graphics': ['그래픽', 'photoshop', 'illustrator', '포토샵', '일러스트'],
    '05_Staticstics': ['통계', 'minitab', 'jmp', 'sas', '미니탭'],
    '06_Site_Custom': ['커스텀', '사이트', '핸디', '기안기', '메신저']
  };
  for (const [type, tkws] of Object.entries(appTypeKeywords)) {
    if (mod.appType.includes(type) && tkws.some(k => q.includes(k))) score += 30;
  }
  if (q.includes('특수') || q.includes('어플리케이션') || q.includes('application') || q.includes('지원범위')) {
    if (mod.appType.includes('03_CAD') || mod.appType.includes('05_') ||
        mod.appType.includes('04_') || mod.appType.includes('06_')) {
      score += 25;
    }
  }
  return score;
}

function scoreProductModule(mod, query) {
  const q = query.toLowerCase()
    .replace(/(은|는|이|가|을|를|의|에|로|으로|하다|해줘|알려줘|설명해줘|뭐야|뭐에요|있나요|있어요)\b/g, '')
    .trim();
  const keywords = q.split(/\s+/).filter(k => k.length > 1);
  let score = 0;
  const productName = PRODUCT_NAME_MAP[mod.product] || mod.product;
  const text = [productName, mod.version, mod.moduleName, mod.description, mod.supportOS, mod.buildEnv, mod.developer]
    .filter(Boolean).join(' ').toLowerCase();
  for (const kw of keywords) {
    if (text.includes(kw)) score += 10;
    if (mod.moduleName.toLowerCase().includes(kw)) score += 30;
    if (productName.toLowerCase().includes(kw)) score += 40;
    if (mod.description.toLowerCase().includes(kw)) score += 20;
  }
  // 모듈/빌드/서버 관련 쿼리 부스트
  if (FIELD_KEYWORDS.module.some(k => q.includes(k))) score += 20;
  // 제품 별칭 매칭
  for (const [name, aliases] of Object.entries(PRODUCT_ALIASES)) {
    if (productName.toLowerCase().includes(name)) {
      for (const alias of aliases) { if (q.includes(alias)) score += 30; }
    }
  }
  return score;
}

// ─── 포맷팅 ───
function formatProductContext(product, query = '') {
  const q = query.toLowerCase();
  let ctx = `[${product.category}] ${product.name}`;
  if (product.version) ctx += ` (버전: ${product.version})`;
  ctx += '\n';
  const isAppQuery = FIELD_KEYWORDS.appSupport.some(k => q.includes(k));
  const isCadQuery = FIELD_KEYWORDS.cadSupport.some(k => q.includes(k));
  const isBrowserQuery = FIELD_KEYWORDS.browserSupport.some(k => q.includes(k));
  const isServerQuery = FIELD_KEYWORDS.serverEnv.some(k => q.includes(k));
  if (isAppQuery && product.appSupport) ctx += `  ⭐ Application 지원범위: ${product.appSupport}\n`;
  if (isCadQuery && product.cadSupport) ctx += `  ⭐ CAD 지원범위: ${product.cadSupport}\n`;
  if (isBrowserQuery && product.browserSupport) ctx += `  ⭐ Browser 지원범위: ${product.browserSupport}\n`;
  if (isServerQuery && product.serverEnv) ctx += `  ⭐ 서버 환경: ${product.serverEnv}\n`;
  if (!isServerQuery && product.serverEnv) ctx += `  서버 환경: ${product.serverEnv}\n`;
  if (product.clientEnv) ctx += `  사용자 환경: ${product.clientEnv}\n`;
  if (!isAppQuery && product.appSupport) ctx += `  Application 지원: ${product.appSupport}\n`;
  if (!isCadQuery && product.cadSupport) ctx += `  CAD 지원: ${product.cadSupport}\n`;
  if (!isBrowserQuery && product.browserSupport) ctx += `  브라우저 지원: ${product.browserSupport}\n`;
  if (product.hwSpec) ctx += `  서버 스펙: ${product.hwSpec}\n`;
  if (product.integration) ctx += `  연동 시스템: ${product.integration}\n`;
  if (product.funcSpec) ctx += `  기능명세서: ${product.funcSpec}\n`;
  if (product.manual) ctx += `  매뉴얼: ${product.manual}\n`;
  if (product.preSurvey) ctx += `  사전환경 조사서: ${product.preSurvey}\n`;
  if (product.note) ctx += `  비고: ${product.note}\n`;
  return ctx;
}

function formatModuleContext(modules, query = '') {
  if (!modules.length) return '';
  const groups = {};
  for (const m of modules) {
    const typeLabel = APP_TYPE_MAP[m.appType] || m.appType;
    if (!groups[typeLabel]) groups[typeLabel] = [];
    groups[typeLabel].push(m);
  }
  let ctx = '📋 지원 어플리케이션 상세 (제어모듈 정보):\n';
  for (const [type, mods] of Object.entries(groups)) {
    ctx += `\n  [${type}]\n`;
    const seen = new Set();
    for (const m of mods) {
      const key = m.appName + m.versions;
      if (seen.has(key)) continue;
      seen.add(key);
      ctx += `  • ${m.appName || '(모듈)'}`;
      if (m.versions) ctx += ` (${m.versions})`;
      ctx += ` - 플랫폼: ${m.platform || 'N/A'}`;
      if (m.developer) ctx += `, 담당: ${m.developer}`;
      if (m.customerCount) ctx += `, 고객수: ${m.customerCount}`;
      ctx += '\n';
      if (m.extensions) ctx += `    지원 확장자: ${m.extensions.substring(0, 150)}${m.extensions.length > 150 ? '...' : ''}\n`;
      const supported = [];
      if (m.features.autoEncrypt === '지원') supported.push('자동암호화');
      if (m.features.secureClipboard === '지원') supported.push('시큐어클립보드');
      if (m.features.securePrint === '지원') supported.push('시큐어프린트');
      if (m.features.watermark === '지원') supported.push('워터마크');
      if (m.features.captureBlock === '지원') supported.push('캡처방지');
      if (supported.length) ctx += `    지원 기능: ${supported.join(', ')}\n`;
      if (m.note) ctx += `    비고: ${m.note}\n`;
    }
  }
  return ctx;
}

function formatProductModuleContext(modules, query = '') {
  if (!modules.length) return '';
  const groups = {};
  for (const m of modules) {
    const prodName = PRODUCT_NAME_MAP[m.product] || m.product;
    if (!groups[prodName]) groups[prodName] = [];
    groups[prodName].push(m);
  }
  let ctx = '🔧 서버/시스템 모듈 상세 (제품모듈 정보):\n';
  for (const [prod, mods] of Object.entries(groups)) {
    ctx += `\n  [${prod}]\n`;
    for (const m of mods) {
      ctx += `  • ${m.moduleName}`;
      if (m.version) ctx += ` (v${m.version})`;
      ctx += '\n';
      if (m.description) ctx += `    기능: ${m.description}\n`;
      if (m.supportOS) ctx += `    지원OS: ${m.supportOS}\n`;
      if (m.platform) ctx += `    플랫폼: ${m.platform}\n`;
      if (m.buildEnv) ctx += `    빌드환경: ${m.buildEnv}\n`;
      if (m.developer) ctx += `    담당: ${m.developer} (${m.team})\n`;
    }
  }
  return ctx;
}

function formatManagerContext(managers) {
  if (!managers.length) return '';
  let ctx = '👥 MTG 운영 담당자:\n';
  for (const m of managers) {
    ctx += `  [${m.division}] 정: ${m.primary.name} (${m.primary.dept})`;
    if (m.secondary.name) ctx += ` / 부: ${m.secondary.name} (${m.secondary.dept})`;
    if (m.note) ctx += ` (${m.note})`;
    ctx += '\n';
  }
  return ctx;
}

// ─── ProductKnowledgeBank 클래스 ───
export class ProductKnowledgeBank {
  constructor() {
    this.products = [];
    this.controlModules = [];
    this.productModules = [];
    this.cadTempData = [];
    this.managers = [];
    this.guidelines = [];
    this.lastFetchTime = 0;
    this.cacheTTL = 30 * 60 * 1000;
    this._lastApiFailure = 0;
    this._apiFailureRetryMs = 5 * 60 * 1000; // API 실패 후 5분간 재시도 방지
  }

  async load(serviceAccountJson = null) {
    if (this.products.length > 0 && (Date.now() - this.lastFetchTime) < this.cacheTTL) return;

    // 임베디드 데이터 직접 로드 (Google Sheets API 권한 미확보 상태)
    // TODO: 서비스 계정에 스프레드시트 공유 권한 부여 후 라이브 연동 활성화
    // 서비스 계정: presales-slack-bot@markany-gemini-api.iam.gserviceaccount.com
    // 스프레드시트1: 1xF0RLe_RLjgS52ZSG1buc2TdbczI0r1hnad64ngtgDc (제품정보)
    // 스프레드시트2: 1sB-fhoSu3tsIUF5mQVsrKQc4bN-s_3-X2F2aoHFf9BU (제어모듈/제품모듈)
    try {
      this.products = parseProducts(getEmbeddedProductData());
      this.managers = getEmbeddedManagers();
      this.guidelines = getEmbeddedGuidelines();
      this.controlModules = getEmbeddedControlModules();
      this.productModules = getEmbeddedProductModules();
      this.lastFetchTime = Date.now();
      console.log(`[KB] Loaded (embedded): ${this.products.length} products, ${this.controlModules.length} ctrl modules, ${this.productModules.length} prod modules, ${this.managers.length} managers`);
    } catch (error) {
      console.error('[KB] Load error:', error);
      if (!this.products.length) {
        this.products = parseProducts(getEmbeddedProductData());
        this.controlModules = getEmbeddedControlModules();
        this.productModules = getEmbeddedProductModules();
        this.managers = getEmbeddedManagers();
      }
    }
  }

  search(query, topK = 5) {
    if (!this.products.length) return { context: '', products: [], modules: [], productModules: [] };
    const q = query.toLowerCase();
    // 1. 제품 검색
    const scoredProducts = this.products
      .map(p => ({ ...p, score: scoreProduct(p, query) }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
    // 2. 제어모듈 검색
    const scoredModules = this.controlModules
      .map(m => ({ ...m, score: scoreModule(m, query) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
    // 3. 제품모듈 검색 (서버사이드)
    const isModuleQuery = FIELD_KEYWORDS.module.some(k => q.includes(k));
    const scoredProdModules = this.productModules
      .map(m => ({ ...m, score: scoreProductModule(m, query) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    // 4. 담당자 검색
    const isManagerQuery = FIELD_KEYWORDS.developer.some(k => q.includes(k));
    // 5. 컨텍스트 조합
    let context = '';
    if (scoredProducts.length) {
      context += '📋 제품 정보 (MTG-MCG HotLine 지식뱅크):\n';
      context += scoredProducts.map(p => formatProductContext(p, query)).join('\n');
    }
    if (scoredModules.length) {
      context += '\n' + formatModuleContext(scoredModules, query);
    }
    if (scoredProdModules.length && (isModuleQuery || scoredProdModules[0].score >= 30)) {
      context += '\n' + formatProductModuleContext(scoredProdModules, query);
    }
    if (isManagerQuery && this.managers.length) {
      context += '\n' + formatManagerContext(this.managers);
    }
    if (context) {
      console.log(`[KB] Found ${scoredProducts.length} products, ${scoredModules.length} ctrl modules, ${scoredProdModules.length} prod modules for "${query}"`);
    }
    return { context, products: scoredProducts, modules: scoredModules, productModules: scoredProdModules };
  }

  getProduct(name) {
    return this.products.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
  }
  getByCategory(cat) {
    return this.products.filter(p => p.category.toLowerCase().includes(cat.toLowerCase()));
  }
  getModulesByAppType(type) {
    return this.controlModules.filter(m => m.appType.toLowerCase().includes(type.toLowerCase()));
  }
  getModulesByAppName(name) {
    return this.controlModules.filter(m => m.appName.toLowerCase().includes(name.toLowerCase()));
  }
  getProductModulesByProduct(name) {
    return this.productModules.filter(m => {
      const prodName = PRODUCT_NAME_MAP[m.product] || m.product;
      return prodName.toLowerCase().includes(name.toLowerCase());
    });
  }
  getManagers() { return this.managers; }
}

// ─── 임베디드 담당자 데이터 ───
function getEmbeddedManagers() {
  return [
    { division: 'DRM 제품군', primary: { dept: 'PIO2센터 IST1팀', name: '김민규' }, secondary: { dept: 'PIO1센터 IST팀', name: '박우호' }, note: '' },
    { division: 'DLP제품군', primary: { dept: 'PIO2센터 IST2팀', name: '남궁열' }, secondary: { dept: 'PIO1센터 BE팀', name: '옥치해' }, note: '' },
    { division: '응용보안 제품군', primary: { dept: 'PIO2센터 AIT팀', name: '임선정' }, secondary: { dept: 'PIO1센터 AIT팀', name: '이호섭' }, note: '' },
    { division: 'TRACER제품군', primary: { dept: 'MTG', name: '박기수' }, secondary: { dept: 'PIO1센터 PRD팀', name: '최완주' }, note: 'Screen/Print SAFER 제외' }
  ];
}
function getEmbeddedGuidelines() {
  return [
    'MCG 영업활동간 필요한 제품에 대한 문의사항 대응을 위한 소통 채널 운영',
    '자사 솔루션 기능, 구성 환경, 지원 범위 등에 대한 문의 채널',
    '고객이 요청하는 Custom 기능에 대한 개발 가능 문의',
    '요청 기능에 대한 Use Case에 대한 설명이 필수',
    '제품군별 담당자 지정하고 슬렉 채널을 개설하여 운영',
    '고객사 유지보수 관련 문의는 담당자에게 직접문의'
  ];
}

// ─── 임베디드 제품모듈 데이터 (서버사이드 모듈) ───
function getEmbeddedProductModules() {
  return [
    // Document SAFER - Unix 서버 데몬
    { product: '01_Document SAFER', version: '51014', moduleName: 'MA_PMS, MA_DDS, MA_DEC, MA_FILECHK', moduleVersion: '', supportOS: 'Sun Solaris, AIX, HP-UX PA, HP-UX IA64, Linux', platform: '32/64', buildEnv: 'make/cc/gcc', team: '1파트', developer: '양정욱', description: '파일 암복호화 데몬', gitPath: '' },
    { product: '01_Document SAFER', version: 'blue', moduleName: 'MA6_PMS, MA6_DDS, MA6_DEC, MA6_FILECHK, MA6_JSWEB, MA6_ODS, MA6_ODS2, MA6_CONF', moduleVersion: '', supportOS: 'Sun Solaris, AIX, HP-UX PA, HP-UX IA64, Linux', platform: '32/64', buildEnv: 'make/cc/gcc', team: '1파트', developer: '양정욱', description: '파일 암복호화 데몬 (Blue)', gitPath: '' },
    { product: '01_Document SAFER', version: 'cipher 2017', moduleName: 'MAuPMS, MAuEnc, MAuDEC, MAuHDR, MAuCONF', moduleVersion: '', supportOS: 'Sun Solaris, AIX, HP-UX PA, HP-UX IA64, Linux', platform: '32/64', buildEnv: 'make/cc/gcc', team: '1파트', developer: '양정욱', description: '파일 암복호화 데몬 (Cipher 2017)', gitPath: '' },
    { product: '01_Document SAFER', version: 'nx', moduleName: 'MANX_PMS, MANX_DDS, MANX_DEC, MANX_FILECHK, MANX_CONF', moduleVersion: '', supportOS: 'Linux', platform: '64', buildEnv: 'make/gcc', team: '1파트', developer: '양정욱', description: '파일 암복호화 데몬 (NX)', gitPath: '' },
    { product: '01_Document SAFER', version: 'C2010R3 자바코어', moduleName: 'libMaDrmDocSaferC2010R3.jar', moduleVersion: '', supportOS: '', platform: '32/64', buildEnv: 'eclipse', team: '1파트', developer: '양정욱', description: '파일 암복호화 자바 Core 라이브러리', gitPath: '' },
    // Document SAFER - Windows 도구
    { product: '01_Document SAFER', version: '2010, 2010R2, 2010R3', moduleName: 'CipherToolPlus.exe', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: '', team: '1파트', developer: '현정환', description: '수동 암호화 툴 (Cipher Dependency)', gitPath: '' },
    { product: '01_Document SAFER', version: '2010, 2010R2, 2010R3', moduleName: 'DeCipherToolPlus.exe', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: '', team: '1파트', developer: '현정환', description: '수동 복호화 툴 (Cipher Dependency)', gitPath: '' },
    { product: '01_Document SAFER', version: 'Blue', moduleName: 'DSCipherToolPlus.exe, DSDeCipherToolPlus.exe', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: '', team: '1파트', developer: '현정환', description: '수동 암/복호화 툴 (Blue Cipher)', gitPath: '' },
    { product: '01_Document SAFER', version: '', moduleName: 'MaWebSocketService.exe, MaWebSocketAgent.exe', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: '', team: '1파트', developer: '현정환', description: 'WebSocket SSO (Windows Service)', gitPath: '' },
    // Document SAFER v4
    { product: '01_Document SAFER', version: 'v4', moduleName: 'Cipher.dll', moduleVersion: '', supportOS: '', platform: 'x86/x64', buildEnv: '', team: '1파트', developer: '현정환', description: 'Document SAFER v4 core 모듈', gitPath: '' },
    { product: '01_Document SAFER', version: 'v4', moduleName: 'DS4_AuditLogBridgeService, DS4_AuthenticationService, DS4_CommonService, DS4_EncDecService 등', moduleVersion: '', supportOS: '', platform: 'x86/x64', buildEnv: '.NET C#', team: '1파트', developer: '현정환', description: 'DS v4 서버 서비스 (WCF Service)', gitPath: '' },
    { product: '01_Document SAFER', version: 'v4', moduleName: 'MaDrmAgent.exe, DSA_CertInstall.dll, MaAgtCtl.dll 등', moduleVersion: '', supportOS: '', platform: 'x86', buildEnv: '', team: '1파트', developer: '현정환', description: 'DSv4 Agent 모듈', gitPath: '' },
    // Document SAFER - Agent
    { product: '01_Document SAFER', version: 'R3/Blue', moduleName: 'MAAgent.exe', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: 'VC2008', team: '1파트', developer: '조규선', description: 'Agent 프로그램', gitPath: '' },
    { product: '01_Document SAFER', version: 'NX', moduleName: 'MAAgent.exe (NX)', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: 'VC2008', team: '1파트', developer: '조규선', description: 'Agent 프로그램 (NX)', gitPath: '' },
    { product: '01_Document SAFER', version: 'V6', moduleName: 'DSU_ServiceV6.exe, DSU_LiveUpdateV6.exe', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: 'VC2008', team: '1파트', developer: '조규선', description: '라이브업데이트 서비스/프로그램', gitPath: '' },
    // FileServer SAFER
    { product: '11_FileServer SAFER', version: '4', moduleName: 'FSSConfig.exe, MFWorker.exe, FSLogger.exe, MFScanner.exe, MFSAgent.exe', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: '', team: '1파트', developer: '현정환', description: 'FileServer SAFER 설정/암복호화/로그/스캔/에이전트', gitPath: '' },
    { product: '11_FileServer SAFER', version: '4', moduleName: 'MaMSMQ.dll, FSSCtrlAD.dll, MaLogHelper.dll, MaDBHelper.dll, MaEncDec.dll', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: '', team: '1파트', developer: '현정환', description: 'FileServer SAFER 공통 라이브러리', gitPath: '' },
    // Mail SAFER
    { product: '10_Mail SAFER', version: '', moduleName: 'MAMS.exe, MaMailClient.exe, SELib.dll, DSLauncher.exe', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86', buildEnv: 'VC6/VC2008', team: '1파트', developer: '조규선', description: '외부 전송 파일 패킹/런처/COM 라이브러리', gitPath: '' },
    // Privacy SAFER Unix
    { product: '03_Privacy SAFER', version: '개인정보 UNIX', moduleName: 'MA_PSR, MA_PSRCHK', moduleVersion: '', supportOS: 'AIX', platform: '32/64', buildEnv: 'make/cc', team: '1파트', developer: '양정욱', description: '파일 개인정보 검출 데몬', gitPath: '' },
    // Others
    { product: '12_Others', version: '라이선스 서버', moduleName: 'licensecheck.jar', moduleVersion: '', supportOS: '', platform: '32/64', buildEnv: 'eclipse', team: '1파트', developer: '양정욱', description: '라이선스 점검 서버', gitPath: '' },
    { product: '12_Others', version: '2', moduleName: 'mcs_agent.exe, mcs_policylib.dll, mcs_logclientlib.dll', moduleVersion: '', supportOS: 'Windows 7+', platform: 'x86/x64', buildEnv: 'VC2017', team: '1파트', developer: '', description: 'Capture SAFER Agent/정책/로그 모듈', gitPath: '' },
  ];
}

// ─── 임베디드 제어모듈 데이터 (특수 어플리케이션/CAD 상세) ───
function getEmbeddedControlModules() {
  return [
    // CAD - AutoDesk
    { product: 'Document SAFER', appType: '03_CAD_AutoDesk', appName: 'AutoCAD', versions: '2004~2026 (Org, Mech, Elec, LT)', exeFile: 'acad.exe', platform: 'x86/x64', moduleName: 'mds_AutoCAD2019.dll / mds_AutoCAD2024.dll', team: '3파트', developer: '김형준', extensions: 'dwg, dws, dwt, dxf, dwf, dwfx, dgn, fbx, sat, stl, iges, igs, xps, png, jpg, bmp, eps, wmf, pdf, stp, ste, step', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '', customerCount: '48' },
    { product: 'Document SAFER', appType: '03_CAD_AutoDesk', appName: 'Inventor', versions: '2018, 2019, 2021, 2023, 2024, 2025', exeFile: 'inventor.exe', platform: 'x86/x64', moduleName: 'DSP_Inventor20xx.dll', team: '3파트', developer: '조규선', extensions: 'dwg, idw, ipt, iam, ipn, dwf, dxf, igs, jt, prt, obj, stp, step, stl, sldprt', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '', customerCount: '10' },
    { product: 'Document SAFER', appType: '03_CAD_AutoDesk', appName: 'DWG TrueView', versions: '2013~2025', exeFile: 'dwgviewr.exe', platform: 'x64', moduleName: 'DSP_ControlMgr.dll (통합모듈)', team: '2파트', developer: '원동진', extensions: 'pdf, dwg, dxf, dwf, dwfx', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '', customerCount: '2' },
    // CAD - CATIA
    { product: 'Document SAFER', appType: '03_CAD_CATIA', appName: 'CATIA', versions: 'V5V14~V5R34', exeFile: 'cnext.exe', platform: 'x86/x64', moduleName: 'MaCatiaLdr.dll / DSP_CatiaRxx.dll', team: '1파트', developer: '양정욱', extensions: 'CATPart, CATProduct, CATDrawing, CATAnalysis, CATMaterial, stp, stpz, igs, dwg, dxf, pdf, stl, 3dxml, cgm, model, session, wrl', features: { usageLog: '지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '', customerCount: '14' },
    { product: 'Document SAFER', appType: '03_CAD_CATIA', appName: 'CATIABatchManagement', versions: 'V5R14, R16, R18', exeFile: 'CATBatch.exe', platform: 'x86', moduleName: 'masdms_CatiaBatchManagement.dll', team: '1파트', developer: '양정욱', extensions: 'CATPart, CATProduct, CATDrawing, stp, igs', features: { usageLog: '지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '지원', watermark: '지원', captureBlock: '미지원' }, note: '', customerCount: '14' },
    // CAD - Others
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'CREO', versions: '2, 3, 4, 6, 9', exeFile: '', platform: 'x64', moduleName: 'DSP_Creo.dll', team: '2파트', developer: '원동진', extensions: 'prt, asm, drw, stp, step, igs, iges, dwg, dxf, stl, pdf, CATPart, CATProduct, sldprt, sldasm, ipt, iam, 3dm, sat, obj, wrl, u3d, 3mf', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'CreoView', versions: '5.1', exeFile: '', platform: 'x64', moduleName: 'DSP_CreoView.dll', team: '2파트', developer: '원동진', extensions: 'ol, pvs, pvz, dwg, dwf, dxf, catpart, catproduct, ipt, iam, stp, cgm, pdf, igs, stl, wrl', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'OrCad', versions: '10.0, 10.3, 10.5, 16, 17.2, 17.4', exeFile: 'capture.exe', platform: 'x86', moduleName: 'MASDMS_OrCad.dll / DSP_OrCAD17.dll', team: '3파트', developer: '조규선', extensions: 'dsn, dbk, brd, dxf, opj', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'Allegro', versions: '15.5', exeFile: 'allegro.exe', platform: 'x86/x64', moduleName: 'DSP_Allegro_v15.dll', team: '1파트', developer: '현정환', extensions: 'brd, mdd, dra, mcm, tmp', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'Altium', versions: '2018', exeFile: '', platform: 'x64', moduleName: 'DSP_Altium.dll', team: '2파트', developer: '원동진', extensions: 'pdf, dwg, dxf, dwf, htm, cam, SchDoc, PcbDoc', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'ChemDraw', versions: 'v19', exeFile: '', platform: 'x86/x64', moduleName: 'DSP_ChemDraw.dll', team: '2파트', developer: '원동진', extensions: 'cdx, cdxml, cds, cml, mol, rxn, sdf, svg, eps', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'ICAD', versions: '2020', exeFile: '', platform: 'x86/x64', moduleName: 'DSP_ICAD.dll', team: '2파트', developer: '원동진', extensions: 'dwg, dwf, pdf, mdwg', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'MODView', versions: 'V12', exeFile: '', platform: 'x64', moduleName: 'DSP_MODView.dll', team: '2파트', developer: '원동진', extensions: 'mv3d, mv2d, 3dxml, model, catpart, igs, jt, stp, stl, CATDrawing, dwg, dxf, pdf', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'OPR3D', versions: 'V5, V8', exeFile: 'opr3d.exe', platform: 'x86/x64', moduleName: 'DSP_OPR3Dv5.dll / DSP_OPR3Dv8.dll', team: '3파트', developer: '조규선', extensions: 'opr3d, mds3d, 3dxml, catpart, catproduct, igs, ipt, iam, jt, sldprt, step, stp, stl, wrl, obj, 3dm', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'PowerLogic', versions: '5.01, 9, 2007', exeFile: 'powerlogic.exe', platform: 'x86', moduleName: 'masdms_plogic.dll', team: '1파트', developer: '현정환', extensions: 'sch', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '미지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'PowerMill', versions: '', exeFile: 'pmill.exe', platform: 'x86', moduleName: 'MASDMS_POWERMILL', team: '1파트', developer: '현정환', extensions: 'dwg, dwf, dxf, igs, stp, psmodel, dgk', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'PowerPCB', versions: '5.01', exeFile: 'PowerPcb.exe', platform: 'x86', moduleName: 'masdms_pwpcb.dll', team: '1파트', developer: '현정환', extensions: 'pcb', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'PowerShape', versions: '', exeFile: 'PowerSHAPE.exe', platform: 'x86', moduleName: 'MASDMS_POWERSHAPE.dll', team: '1파트', developer: '현정환', extensions: 'dwg, dwf, dxf, igs, stp, psmodel, dgk', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'VisMockup', versions: '4.1, 5.1', exeFile: 'VisView.exe', platform: 'x86', moduleName: 'masdms_VisMockup.dll', team: '1파트', developer: '현정환', extensions: 'dwg, cgm, hpg, jt, tif, tiff', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // OA - MS Office
    { product: 'Document SAFER', appType: '02_OA _MS-Office', appName: 'Word', versions: '2003~2024', exeFile: 'winword.exe', platform: 'x86/x64', moduleName: 'dsp_01_2016.dll', team: '1파트', developer: '현정환', extensions: 'doc, docx, docm, dot, dotx, dotm, pdf, xps, rtf, txt, xml, odt, hwp', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA _MS-Office', appName: 'Excel', versions: '2003~2016', exeFile: 'excel.exe', platform: 'x86/x64', moduleName: 'DSP_03_2016.DLL', team: '1파트', developer: '현정환', extensions: 'xls, xlt, xltx, xla, xlsx, xlsm, xlsb', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA _MS-Office', appName: '파워포인트', versions: '2003~2024', exeFile: 'powerpnt.exe', platform: 'x86/x64', moduleName: 'DSP_02_2016.dll', team: '1파트', developer: '최윤석', extensions: 'ppt, pps, pptx, pptm, potx, ppsx, ppam, thmx', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA _MS-Office', appName: 'ms-teams', versions: '', exeFile: 'ms-teams.exe', platform: 'x86/x64', moduleName: 'DSP_Teams.dll', team: '1파트', developer: '허진구', extensions: 'CCF에 설정', features: {}, note: '' },
    { product: 'Document SAFER', appType: '02_OA _MS-Office', appName: '엑셀 파워쿼리', versions: '', exeFile: 'Microsoft.Mashup.Container.NetFX40.exe', platform: 'x86', moduleName: 'MDS_MashupContainer.dll', team: '1파트', developer: '현정환', extensions: 'xls, xlsx, txt, xml, csv', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '미지원', watermark: '미지원', captureBlock: '미지원' }, note: 'UI 없이 엑셀 addin 형태로 실행' },
    // OA - 한컴오피스
    { product: 'Document SAFER', appType: '02_OA_Haancom-Office', appName: '한컴오피스', versions: '2014, NEO, 2018, 2020, 2022, 2024', exeFile: 'hwp.exe', platform: 'x86', moduleName: 'DSP_HOFFICE.dll', team: '1파트', developer: '최윤석', extensions: 'hml, hwp, htm, html, odt, pdf, txt, rtf, doc, docx, xml, hwpx, csv, json', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Haancom-Office', appName: '한글2010', versions: '', exeFile: 'hwp.exe', platform: 'x86', moduleName: 'DSP_HWP_2010.dll', team: '1파트', developer: '최윤석', extensions: 'hml, hwp, htm, html, odt, pdf, txt, rtf, doc, docx, hwpx', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Haancom-Office', appName: '한컴 오피스 뷰어', versions: '2005~2024', exeFile: 'hwpview.exe', platform: 'x86', moduleName: 'DSP_ControlMgr.dll (통합모듈)', team: '2파트', developer: '원동진', extensions: 'doc, docx, hwp, hwt, xls, xlsx, ppt, pptx, show', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // OA - PDF
    { product: 'Document SAFER', appType: '02_OA_PDF', appName: 'Adobe Acrobat Reader/Pro', versions: '6.0~25.0 (DC)', exeFile: 'acrord32.exe / acrobat.exe', platform: 'x86', moduleName: 'DSP_PDF_ControlMgr.dll', team: '1파트', developer: '현정환', extensions: 'PDF', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_PDF', appName: 'PDF XChange Pro', versions: '3.0~9.4', exeFile: 'PDFXEdit.exe', platform: 'x86/x64', moduleName: 'DSP_PDF_XEdit.dll', team: '1파트', developer: '현정환', extensions: 'PDF', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // OA - Others
    { product: 'Document SAFER', appType: '02_OA_Others', appName: '그림판', versions: 'Windows 10, 11', exeFile: 'mspaint.exe', platform: 'x86/x64', moduleName: 'DSP_MSPaint.dll', team: '2파트', developer: '이태양', extensions: 'bmp, jpg, jpeg, gif, tif, tiff, png', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Others', appName: '메모장', versions: '', exeFile: 'notepad.exe', platform: 'x86/x64', moduleName: 'DSP_ControlMgr.dll (통합모듈)', team: '2파트', developer: '원동진', extensions: '모든 확장자', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Others', appName: 'Notepad++', versions: '7.7', exeFile: 'Notepad++.exe', platform: 'x86', moduleName: 'DSP_Notepad++.dll', team: '1파트', developer: '', extensions: 'txt', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Others', appName: 'EditPlus', versions: '', exeFile: 'editplus.exe', platform: 'x86', moduleName: 'DSP_Eplus.dll', team: '1파트', developer: '', extensions: 'txt', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Others', appName: 'UltraEdit', versions: '12~30', exeFile: 'Uedit32.exe', platform: 'x86/x64', moduleName: 'DSP_UEDIT.dll', team: '', developer: '원동진', extensions: 'txt, doc, bat, ini, c, cpp, h, html, java, csv, xml', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Others', appName: '훈민정음', versions: '2K, XP', exeFile: 'hun2k.exe', platform: 'x86', moduleName: 'DSP_HUN2K.dll', team: '1파트', developer: '최윤석', extensions: 'gul, txt, frm, bkg, sav, rtf', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Others', appName: '정음글로벌', versions: '', exeFile: 'JungUmGW.exe', platform: 'x86', moduleName: 'DSP_JUNGUM.dll', team: '1파트', developer: '최윤석', extensions: 'gul, doc, hwp, pdf, txt, rtf', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_Others', appName: 'Spotfire', versions: '11.x', exeFile: 'spotfire.exe', platform: 'x86', moduleName: 'DSP_SPF.dll', team: '1파트', developer: '', extensions: 'dxp', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // Graphics
    { product: 'Document SAFER', appType: '04_Graphics', appName: 'PhotoShop', versions: '5.5, 7, CS~CS6, 2022', exeFile: '', platform: '', moduleName: 'DSP_PhotoShop.dll', team: '2파트', developer: '최윤석', extensions: '', features: {}, note: '' },
    { product: 'Document SAFER', appType: '04_Graphics', appName: 'Illustrator', versions: 'CS~CS6, 9, 2022', exeFile: '', platform: 'x86/x64', moduleName: 'DSP_Illustrator.dll', team: '2파트', developer: '최윤석', extensions: '', features: {}, note: '' },
    { product: 'Document SAFER', appType: '04_Graphics', appName: '이지포토', versions: '3.4 (해군전용)', exeFile: 'EzPhoto.exe', platform: 'x86', moduleName: 'DSP_ExPhoto3.dll', team: '3파트', developer: '조규선', extensions: 'bmp, jpg, tif, png, gif, eps, psd, ezi, ezix', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '04_Graphics', appName: '다씨', versions: '', exeFile: 'DaSee.exe', platform: 'x86', moduleName: 'DSP_DaSee.dll', team: '1파트', developer: '최윤석', extensions: 'jpg, jpeg, gif, png, tif, tiff, bmp, dib', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '04_Graphics', appName: 'XRapidView', versions: 'R7', exeFile: 'IExplore.EXE', platform: 'x86', moduleName: 'DSP_RapidViewAx.dll', team: '1파트', developer: '현정환', extensions: 'tif, pdf, dwg', features: { usageLog: '미지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '미지원', secureClipboard: '미지원', securePrint: '미지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // Statistics
    { product: 'Document SAFER', appType: '05_Staticstics', appName: 'MINITAB', versions: '14, 15, 17, 18, 19, 20', exeFile: 'mtb.exe', platform: 'x86/x64', moduleName: 'DSP_Minitab.dll', team: '1파트', developer: '최윤석', extensions: 'mpx, mwx, csv, txt, xls, xlsx, xml', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '05_Staticstics', appName: 'JMP', versions: '10~14', exeFile: 'JMP.exe', platform: 'x86/x64', moduleName: 'DSP_JMP.dll', team: '1파트/3파트', developer: '현정환/조규선', extensions: 'jmp, sas7bdat, xpt, xls, xlsx, xlsm, txt, csv, dat, tsv', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '13, 14 버전은 조규선 차장 담당' },
    { product: 'Document SAFER', appType: '05_Staticstics', appName: 'SAS', versions: '', exeFile: 'sas.exe', platform: 'x86', moduleName: 'DSP_SAS.dll', team: '1파트', developer: '최윤석', extensions: 'xls, txt, sas', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // Site Custom
    { product: 'Document SAFER', appType: '06_Site_Custom_App.', appName: 'SAP', versions: '750, 770, 800', exeFile: 'saplogon.exe', platform: 'x86', moduleName: 'DSP_SAP.dll', team: '1파트', developer: '최윤석', extensions: '', features: { usageLog: '지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '06_Site_Custom_App.', appName: '핸디결제', versions: '', exeFile: 'HDFileManager.exe', platform: 'x86', moduleName: 'masdmsSAViewX.dll', team: '1파트', developer: '양정욱', extensions: 'hwp, doc, ppt, xls, docx, pptx, xlsx, rtf, pdf', features: { usageLog: '미지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '06_Site_Custom_App.', appName: '신보험(NewInsurance)', versions: '', exeFile: 'javaw_new_ins.exe', platform: 'x86', moduleName: 'MaNewInsurance.dll', team: '1파트', developer: '현정환', extensions: 'txt', features: { usageLog: '미지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '미지원', secureClipboard: '미지원', securePrint: '미지원', watermark: '미지원', captureBlock: '지원' }, note: '교보생명' },
    { product: 'Document SAFER', appType: '06_Site_Custom_App.', appName: 'EcMiner', versions: '', exeFile: 'ECMinerFD.exe', platform: 'x86/x64', moduleName: 'DSP_ECMiner.dll', team: '1파트', developer: '현정환', extensions: '', features: { usageLog: '미지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '미지원', secureClipboard: '미지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '금융정보분석원' },
    { product: 'Document SAFER', appType: '06_Site_Custom_App.', appName: 'KR메신저', versions: '', exeFile: 'EzQ.exe', platform: 'x86', moduleName: 'DSP_KRSMessenger.dll', team: '1파트', developer: '현정환', extensions: '', features: { usageLog: '미지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '미지원', secureClipboard: '지원', securePrint: '미지원', watermark: '미지원', captureBlock: '미지원' }, note: 'Clipboard만 제어' },
    { product: 'Document SAFER', appType: '06_Site_Custom_App.', appName: 'LIMS', versions: '', exeFile: 'LabMate.net.exe', platform: 'x86', moduleName: 'masdmsLIMS.dll', team: '1파트', developer: '현정환', extensions: 'xls, txt, pdf, xml, doc, ppt, csv, xlsx, docx, pptx', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '동양제철화학' },
    { product: 'Document SAFER', appType: '06_Site_Custom_App.', appName: 'OnMES', versions: '', exeFile: 'OCIINC.SmartFactory.FW.Win.Loader.exe', platform: 'x86', moduleName: 'DSP_OnMesMalaysia.dll', team: '1파트', developer: '현정환', extensions: '저장되는 모든 확장자', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // Others
    { product: 'Document SAFER', appType: '08_others', appName: 'PlusViewer', versions: '2', exeFile: 'PlusV2.exe', platform: 'x86', moduleName: 'DSP_PlusView.dll', team: '1파트', developer: '현정환', extensions: 'ncf, pcm', features: { usageLog: '지원', viewCount: '지원', printCount: '미지원', autoEncrypt: '미지원', secureClipboard: '지원', securePrint: '지원', watermark: '미지원', captureBlock: '지원' }, note: '' },
    // CAD - ZWCAD (NEW)
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'ZWCAD', versions: '2018, 2023, 2024, 2025', exeFile: 'zwcad.exe', platform: 'x86/x64', moduleName: 'DSP_ZWCAD2018.dll / DSP_ZWCAD2023.dll / DSP_ZWCAD2024.dll / DSP_ZWCAD2025.dll', team: '3파트', developer: '조규선', extensions: 'dwg, dxf, dwt, dwf, dwfx', features: { usageLog: '지원', viewCount: '', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '', customerCount: '5' },
    // CAD - SolidWorks (NEW)
    { product: 'Document SAFER', appType: '03_CAD_SolidWorks', appName: 'SolidWorks', versions: '2010~2025', exeFile: 'sldworks.exe', platform: 'x64', moduleName: 'mds_SLDWORKS202264.dll / mds_SLDWORKS2022_Ex64.dll', team: '3파트', developer: '김형준', extensions: 'sldprt, sldasm, slddrw, drw, prt, asm, stp, step, stl, igs, iges, dwg, dxf, pdf, 3dxml, sat, vda, 3mf, obj', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '2015부터 64bit만 지원', customerCount: '18' },
    { product: 'Document SAFER', appType: '03_CAD_SolidWorks', appName: 'SolidWorks eDrawings 뷰어', versions: '2016~2019', exeFile: 'eDrawings.exe', platform: 'x64', moduleName: 'DSP_SLDWORKS_eDrawing20xx64.dll', team: '3파트', developer: '김형준', extensions: 'sldprt, sldasm, slddrw 등', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: 'Solidworks 2022용 제어모듈로 대체됨' },
    // CAD - Cadian (NEW)
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'Cadian', versions: '2014, 2017, 2021, 2023~2025', exeFile: 'icad.exe', platform: 'x64', moduleName: 'DSP_CADian_Ldr64.dll / DSP_CADian202364.dll', team: '3파트', developer: '강석훈', extensions: 'dwg, dxf, dws, dwf, dwfx, dwt, dgn, wmf, dae, sat, pdf, svg, bmp, png, stl, iges, step, stp', features: { usageLog: '지원', viewCount: '미지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '2021부터 64bit 통합모듈', customerCount: '8' },
    // CAD - Autodesk Revit (NEW)
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'Autodesk Revit', versions: '2021, 2022', exeFile: 'Revit.exe', platform: 'x64', moduleName: 'mds_Revit_Ldr64.dll / mds_Revit202164.dll', team: '3파트', developer: '김형준', extensions: 'App 지원 모든 확장자', features: { usageLog: '지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: 'Storage 파일 메모리 복호화 이슈 있음', customerCount: '1' },
    // CAD - Oracle AutoVue (NEW)
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'Oracle AutoVue', versions: '21.x.x', exeFile: 'AutoVue.exe', platform: 'x86', moduleName: 'DSP_AutoVue21.dll', team: '3파트', developer: '김형준', extensions: 'dwg, dxf, bmp, gif, jpeg, jpg, png, tif, tiff, dgn, xlsx, pptx, docx, vsd, vsdx, pdf, sldasm, slddrw, sldprt', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // CAD - Flare3 (NEW)
    { product: 'Document SAFER', appType: '03_CAD_Others', appName: 'Flare3', versions: '3.0', exeFile: 'Flare3.exe', platform: '', moduleName: 'mds_Flare3.dll', team: '3파트', developer: '김형준', extensions: 'flr, sdf, sd, mol, mol2, sm2, smi, pdb, gz, xed, png, jpg, bmp', features: { usageLog: '지원', viewCount: '지원', printCount: '미지원', autoEncrypt: '지원', secureClipboard: '미지원', securePrint: '미지원', watermark: '미지원', captureBlock: '지원' }, note: '화학 분자 프로그램' },
    // OA - MS Visio (NEW)
    { product: 'Document SAFER', appType: '02_OA _MS-Office', appName: 'MS Visio', versions: '2002~2003, 2013+', exeFile: 'visio.exe', platform: 'x86/x64', moduleName: 'DSP_Visio2013.dll / DSP_Visio201364.dll', team: '3파트', developer: '김형준', extensions: 'vsdx, vsdm, vsd, vdx, vssx, vssm, vss, vstx, vstm, vst, dwg, dxf, pdf, svg, htm, html', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // OA - MS OneNote (NEW)
    { product: 'Document SAFER', appType: '02_OA _MS-Office', appName: 'MS OneNote', versions: '2013, 2016', exeFile: 'ONENOTE.EXE', platform: 'x86/x64', moduleName: 'DSP_OneNote2013.dll / DSP_OneNote2016.dll', team: '3파트', developer: '김형준', extensions: 'one, onetoc2', features: { usageLog: '미지원', viewCount: '미지원', printCount: '미지원', autoEncrypt: '미지원', secureClipboard: '미지원', securePrint: '미지원', watermark: '미지원', captureBlock: '미지원' }, note: '로컬 암호화 파일 읽기 및 저장시 암호화만 지원' },
    // OA - PDF 추가 (NEW)
    { product: 'Document SAFER', appType: '02_OA_PDF', appName: 'Xodo PDF Viewer', versions: '', exeFile: 'MAPDFViewer_SDI.exe', platform: 'x86', moduleName: 'DSP_PDF_XODO.dll', team: '1파트', developer: '현정환', extensions: 'PDF', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '02_OA_PDF', appName: 'ezPDFReader', versions: '', exeFile: 'ezPDFReader.exe', platform: 'x86', moduleName: 'DSP_EZ_PDF.dll', team: '1파트', developer: '현정환', extensions: 'PDF', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    // Others - 뷰어 (NEW)
    { product: 'Document SAFER', appType: '08_others', appName: 'OZC 뷰어', versions: '', exeFile: 'OZCViewer.exe', platform: 'x86', moduleName: 'DSP_OZCViewer.dll', team: '1파트', developer: '최윤석', extensions: 'ozd, pdf, xls, xlsx, doc, ppt, html, csv, mht, txt', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
    { product: 'Document SAFER', appType: '08_others', appName: 'Rexpert뷰어', versions: '', exeFile: 'iexplore.exe', platform: 'x86', moduleName: 'DSP_RexpertViewer.ocx', team: '1파트', developer: '최윤석', extensions: 'xls, pdf, hwp, txt, xml', features: { usageLog: '지원', viewCount: '지원', printCount: '지원', autoEncrypt: '지원', secureClipboard: '지원', securePrint: '지원', watermark: '지원', captureBlock: '지원' }, note: '' },
  ];
}

// ─── 임베디드 제품 데이터 (API 접근 불가 시 fallback) ───
function getEmbeddedProductData() {
  return [
    ['', 'DRM 제품군', 'Document SAFER', 'Green(v7.0), Blue3(v3.0.02)', 'IST_표준기능정의서', '02_Document SAFER', 'IST_프로젝트_스펙정의서_KOR_.v1.4.xlsx', 'HW_SPEC', 'OS: windows, Ubuntu, Rocky / WAS: tomcat 9.0.65 / DB: Oracle 19c, MSSQL 2019, Maria 11.0.2 / JDK: java 1.8', 'Windows 7,8,10,11 (32/64bit)', '표준 OA(Office, HWP, PDF, Notepad) 최신 버전까지 지원 + 특수 어플리케이션(CAD, 통계, 그래픽 등) ES사업부_제품개발팀_제품별_모듈담당자_V2.0 참조', 'AutoCAD, CATIA, CREO, Inventor, SolidWorks, ZWCAD(Full 2018/2023/2024/2025), OrCad, Allegro, Altium, ChemDraw, ICAD, MODView, OPR3D, PowerLogic, PowerMill, PowerPCB, PowerShape, VisMockup, CreoView, DWG TrueView, Cadian, Autodesk Revit, Oracle AutoVue, Flare3 등', '', '', 'MS오피스 DRM & MIP 저장 정책'],
    ['', '', 'Privacy SAFER', 'v3.1', 'IST_표준기능정의서', '05_Privacy SAFER', 'IST_프로젝트_스펙정의서_KOR_.v1.4.xlsx', 'HW_SPEC', '상동', 'Windows 7,8,10,11 (32/64bit)', '', '', '', '', ''],
    ['', '', 'Print SAFER', 'v4.0', 'IST_표준기능정의서', '04_Print SAFER', 'IST_프로젝트_스펙정의서_KOR_.v1.4.xlsx', 'HW_SPEC', '상동', 'Windows 7,8,10,11 (32/64bit)', '', '', '', '', ''],
    ['', '', 'Print TRACER', 'v4.0', '', '', 'IST_프로젝트_스펙정의서_KOR_.v1.4.xlsx', 'HW_SPEC', '상동', 'Windows 7,8,10,11 (32/64bit)', '', '', '', '', 'Print SAFER내 비가시성 기능으로 제공'],
    ['', '', 'Screen SAFER', 'v3.0', 'IST_표준기능정의서', '03_Screen SAFER', 'IST_프로젝트_스펙정의서_KOR_.v1.4.xlsx', 'HW_SPEC', '상동', 'Windows 7,8,10,11 (32/64bit)', '', '', '', '', ''],
    ['', '', 'Screen TRACER', 'v3.0', '', '', 'IST_프로젝트_스펙정의서_KOR_.v1.4.xlsx', 'HW_SPEC', '상동', 'Windows 7,8,10,11 (32/64bit), MAC OS', '', '', '', '', 'Screen SAFER내 비가시성 기능으로 제공'],
    ['', '', 'Web SAFER', 'v5.0', '', '08_Web SAFER', '', '', '고객사 서버 환경에 따름', 'Windows 7,8,10,11 (32/64bit)', 'Chrome, Edge, Firefox, Opera, Whale', '', 'Chrome, Edge, Firefox, Opera, Whale', '', ''],
    ['', '', 'Cowork SAFER', 'v2.0', 'IST_표준기능정의서', '06_Cowork SAFER', '', '', 'OS: windows, Ubuntu, Rocky / WAS: tomcat 9.0.65 / DB: Oracle 19c, MSSQL 2019, Maria 11.0.2 / JDK: java 1.8', 'Windows 7,8,10,11 (32/64bit)', 'MS-Office, 한글, PDF', '', '', '', ''],
    ['', '', 'Mobile DOCS', 'Android: 4.x.x / IOS: 3.x.xx', 'Mobile Docs_기능정의서_v_0.2.xlsx', '09_Mobile Docs', '', '', '상동', '최소 OS: Android 7, IOS 14', '', '', '', '', ''],
    ['', '', 'Mobile SAFER', 'Android: 3.00.xxxx / IOS: 2.00.xxxx', 'Mobile SAFER (요구 명세서).pdf', '07_Mobile SAFER', '', '', 'OS: Rocky 9 / WAS: Tomcat 8.5~9.0 / DB: MySQL 5.7~8, Oracle / JDK: 1.8', '최소 OS: Android 10, IOS 14', '', '', '', '', ''],
    ['', '', 'Mobile STICKER', 'Android: 1.0.106 / IOS: 1.0.58', 'Mobile STICKER (요구 명세서).pdf', '10_Mobile STICKER', '', '', 'N/A', '최소 OS: Android 7, IOS 10', '', '', '', '', ''],
    ['', '', 'Mobile Capture SAFER', 'Android: 2.5.xx / IOS: 1.2.xx', 'Capture SAFER_V1.2_통합_기능정의서.pptx', '13_Mobile Capture SAFER', '', '', 'N/A', '최소 OS: Android 7, IOS 15', '', '', '', '', ''],
    ['', '', 'iScreen SAFER', 'IOS: 2.1.02', '', '11_IScreen SAFER', '', '', 'N/A', '최소 OS: IOS 11', '', '', '', '', ''],
    ['', '', '국방모바일보안', '', '02_MMSA_1R14a_요구사항정의서_V1.0.xlsx', '14_국방모바일보안앱', '', '', 'N/A', '최소 OS: Android 7, IOS 10', '', '', '', '', ''],
    ['', '', 'Document SAFER I/F(Server)', 'Windows/Linux/Unix', '연동IF정의서', 'Server DRM / MaFileCipherXU', 'MarkAny Unix 설치 지원 요청서 양식.xls', '서버DRM 스펙 참조', 'IBM AIX, SUN Solaris, HP HP-UX, Linux / JDK 1.2+', 'Windows Server 2016~2025 / Unix 계열', 'N/A', 'N/A', 'N/A', 'JAVA/C 인터페이스 모든 시스템 적용 가능', ''],
    ['', '', 'Document SAFER I/F(Client)', 'Document SAFER 버전에 따름', '', 'DSFileCipherX', '', '', '', 'Windows 7,8,10,11 (32/64bit)', 'N/A', 'N/A', 'N/A', '', ''],
    ['', '', 'MACRYPTO V3.0(KCMVP)', 'V3.00', '20_Macrypto V3.00 (보안정책정의서)', '20_Macrypto V3.00', '', '', '', '', 'N/A', 'N/A', 'N/A', '', ''],
    ['', '', 'ES SAFER', '각각 개별 제품 버전으로 관리됨', '', '01_ES SAFER', 'IST_프로젝트_스펙정의서_KOR_.v1.4.xlsx', '', '', '', '', '', '', '', ''],
    ['', 'DLP 제품군', 'SafePC Enterprise', 'V7.0', 'SAFEPC_정책정의서.xlsx', 'SafePC Enterprise V7.0 매뉴얼', 'DST_프로젝트_스펙정의서_KOR_.v1.0.xlsx', '세솔/보이저 Appliance', 'OS: RedHat 9.4 / Rocky 9.4 / WAS: Tomcat 9.0.102 / DB: MariaDB 11.4.2 / JDK: OpenJDK 21.0.1', 'Windows10 (32/64bit), Windows11 (64bit)', 'N/A', 'N/A', 'Chrome, Edge, Firefox', '', '기존 SecuPrint 기능 신규 제공 불가'],
    ['', '', 'SafeUSB', 'V7.1', 'SAFEPC_정책정의서.xlsx', 'SafeUSB+ V7.0 매뉴얼', 'DST_프로젝트_스펙정의서_KOR_.v1.0.xlsx', '세솔/보이저 Appliance', 'OS: RedHat 9.4 / Rocky 9.4 / WAS: Tomcat 9.0.102 / DB: MariaDB 11.4.2 / JDK: OpenJDK 21.0.1', 'Windows10 (32/64bit), Windows11 (64bit)', 'N/A', 'N/A', 'Chrome, Edge, Firefox', '', ''],
    ['', '응용보안 제품군', 'ePage SAFER', 'v2.5', 'EVM-ePageSAFER v2.5 (요구 명세서).pdf', 'ePageSAFER 매뉴얼', 'AIT_ePS_사전조사서.xls', 'N/A', 'OS: Windows NT, Unix(AIX 4.3+, Solaris 5.7+, HP-UX 11.0+), Linux / WAS: ALL / JDK: 1.4+', 'Windows 7,8,10,11 / Linux / Mac 10.10+', 'N/A', 'N/A', 'Chrome, Edge, Firefox, Opera, Whale', 'HTML 서식, 리포트(ClipReport, Crownix, OzReport, UbiReport), PDF 연동', ''],
    ['', '', 'VoiceBarcode', 'v2.5', '', '', '', '', '', '', '', '', '', '', ''],
    ['', '', 'ePage SAFER for Web DRM', 'v2.5', 'EVM-e-PageSAFER_V2.5 WebDRM 요구명세서.pdf', 'ePageSAFER WebDRM 매뉴얼', 'AIT_ePS_사전조사서.xls', 'N/A', 'OS: Windows 7,8,10,11 / WEB/WAS: ALL', 'Windows 7,8,10,11 (32/64bit)', 'N/A', 'N/A', 'Chrome, Edge, Firefox, Opera, Whale', 'Nexacro NRE/WRE', ''],
    ['', '', 'ePS DocumentMerger', 'v2.5', '', 'ePS DocumentMerger 매뉴얼', 'AIT_ePS_MaDM_사전조사서.xls', 'N/A', 'OS: Windows NT, Unix, Linux / WAS: ALL / JDK: 1.4+', 'Windows 7,8,10,11 / Linux / Mac 10.10+', 'N/A', 'N/A', 'Chrome, Edge, Firefox, Opera, Whale', '', ''],
    ['', '', 'ePS Document DNA', 'v2.5', '', 'ePS Document DNA 매뉴얼', 'AIT_ePS_MaDM_사전조사서.xls', 'N/A', 'OS: Windows NT(PDF변환시 필수), Unix, Linux / WAS: ALL / JDK: 1.4+', 'Windows 7,8,10,11 / Linux / Mac 10.10+', 'N/A', 'N/A', 'Chrome, Edge, Firefox, Opera, Whale', '', ''],
    ['', 'TRACER 제품군', 'TRACER SDK for Screen', 'V1.0', 'N/A', '매뉴얼', '', 'N/A', 'Windows Server, Linux', 'Windows 10, 11, MAC OS', 'N/A', '', '', '', '화면보호 SW Add-in'],
    ['', '', 'TRACER SDK for Print', 'V1.0', 'N/A', '매뉴얼', '', 'N/A', 'Windows Server, Linux', 'Windows 10, 11', 'N/A', '', '', '', '출력보호 SW Add-in'],
    ['', '', 'TRACER SDK for Web', 'V1.0', 'N/A', '매뉴얼', '', 'N/A', 'Windows Server, Linux', '서버 Side', 'N/A', '', 'Chrome, Edge, Firefox, Opera, Whale', '', '적용 시스템 Add-in'],
    ['', '', 'TRACER SDK for Mobile', 'V1.0', 'N/A', '매뉴얼', '', 'N/A', '', '최소 OS: Android 7, IOS 10', 'N/A', '', '', '', 'App Add-in'],
  ];
}

// Singleton
export const productKnowledgeBank = new ProductKnowledgeBank();
