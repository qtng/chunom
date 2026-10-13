/*
Quốc Ngữ syllable -> IPA (northern and southern Vietnamese), after the Glyph model of the old website.
  ChunomIpa.fromQuocNgu('tên')  ->  { north: 'tenɫ'-like string, south: '…' }  ('' when there is no vowel)
  ChunomIpa.north('tên'), ChunomIpa.south('tên')
*/
(function () {
const INITIAL_NORTH = {
  '': 'ʔ', b: 'ɓ', ch: 'c', k: 'k', dh: 'ɗ', d: 'z', ph: 'f', g: 'ɣ', gi: 'z', h: 'h', kh: 'x', l: 'l', m: 'm',
  n: 'n', ng: 'ŋ', nh: 'ɲ', qu: 'k', r: 'z', s: 's', t: 't', th: 'tʰ', tr: 'c', v: 'v', x: 's',
};
const INITIAL_SOUTH = { ...INITIAL_NORTH, v: 'j', gi: 'j', d: 'j', kh: 'kʰ', r: 'ʐ', tr: 'ʈʐ' };
const NUCLEUS = {
  a: 'aː', 'a+': 'ă', e: 'e', i: 'i', o: 'o', u: 'u', 'ü': 'ɨ',
  'ö': 'əː', 'e+': 'ɛː', 'i+': 'iə', 'o+': 'ɔː', 'u+': 'uə', 'ö+': 'ə̆', 'ü+': 'ɨə',
};
const SPECIALS_NORTH = {
  'o+ng': 'ău̯ŋ͡m', 'o+c': 'ău̯k͡p̚', ong: 'ə̆u̯ŋ͡m', oc: 'ə̆u̯k͡p̚', 'öng': 'ăi̯ŋ', 'öc': 'ăi̯k̚',
  eng: 'ə̆i̯ŋ', ec: 'ə̆i̯k̚', ing: 'i̯ŋ', ic: 'i̯k̚', ung: 'uŋ͡m', uc: 'uk͡p̚',
  an: 'an', 'a+n': 'ăn', en: 'en', 'e+n': 'ɛːn', in: 'ɪn', 'i+n': 'iəŋ', on: 'on', 'o+n': 'ɔːn',
  un: 'ʊn', 'u+n': 'uən', 'ön': 'əːn', 'ö+n': 'ə̆n', 'ün': 'ɨn', 'ü+n': 'ɨən', 'üu': 'iw', 'ü+u': 'iəw',
};
const SPECIALS_SOUTH = {
  ...SPECIALS_NORTH,
  'öng': 'ăn', 'öc': 'ăt̚', eng: 'ə̆n', ec: 'ə̆t̚', ing: 'i̯n', ic: 'i̯t̚',
  an: 'aŋ', 'a+n': 'ăŋ', en: 'əːn', 'e+n': 'ɛəŋ', in: 'ɪn', 'i+n': 'iəŋ', on: 'oŋ͡m', 'o+n': 'ɔːŋ',
  un: 'ʊŋ͡m', 'u+n': 'uəŋ', 'ön': 'əːŋ', 'ö+n': 'ə̆ŋ', 'ün': 'ɨŋ', 'ü+n': 'ɨəŋ',
  at: 'ak̚', 'a+t': 'ăk̚', et: 'əːt', 'e+t': 'ɛək̚', it: 'ɪt', 'i+t': 'iək̚', ot: 'ok͡p̚', 'o+t': 'ɔːk̚',
  ut: 'ʊŋ͡m', 'u+t': 'uəŋ', 'öt': 'əːŋ', 'ö+t': 'ə̆ŋ', 'üt': 'ɨŋ', 'ü+t': 'ɨəŋ',
  'üu': 'ɨw', 'ü+u': 'ɨəw',
};
const FINAL = { n: 'n', m: 'm', p: 'p̚', c: 'k̚', t: 't̚', ng: 'ŋ', j: 'j', w: 'w' };
const TONE_NORTH = ['˧', '˧˥', '˧˩˨', '˧ˀ˥', '˨˩', '˨˩ˀ'];
const TONE_SOUTH = ['˧', '˥', '˩˥', '˩˥', '˩', '˩˧'];

const TONES = [null, /[áéíóúýắấếốứớ]/, /[ảẻỉỏủỷẳẩểổửở]/, /[ãẽĩõũỹẵẫễỗữỡ]/, /[àèìòùỳằầềồừờ]/, /[ạẹịọụỵặậệộựợ]/];
const VOWELS = /[aeiouyăâêôươáéíóúýắấếốứớảẻỉỏủỷẳẩểổửởãẽĩõũỹẵẫễỗữỡàèìòùỳằầềồừờạẹịọụỵặậệộựợ]+/;
// plain vowel -> internal letter (ä = ă, ö = ơ, â stays, ü = ư)
const VOWEL_CLASSES = [
  [/[aáảãàạ]/g, 'a'], [/[ơớởỡờợ]/g, 'ö'], [/[ăắẳẵằặ]/g, 'ä'], [/[âấẩẫầậ]/g, 'â'],
  [/[eéẻẽèẹ]/g, 'e'], [/[êếểễềệ]/g, 'ê'], [/[iíỉĩìị]/g, 'i'], [/[oóỏõòọ]/g, 'o'], [/[ôốổỗồộ]/g, 'ô'],
  [/[uúủũùụ]/g, 'u'], [/[ưứửữừự]/g, 'ü'], [/[yýỷỹỳỵ]/g, 'y'],
];
const INITIALS2 = ['gi', 'ch', 'kh', 'nh', 'ng', 'ph', 'th', 'tr', 'qu'];
const INITIAL1 = { b: 'b', c: 'k', d: 'd', 'đ': 'dh', g: 'g', h: 'h', k: 'k', l: 'l', m: 'm', n: 'n', r: 'r', s: 's', t: 't', v: 'v', x: 'x' };
const NUCLEUS1 = { a: 'a', ä: 'a+', ê: 'e', e: 'e+', i: 'i', y: 'i', ô: 'o', o: 'o+', 'ö': 'ö', â: 'ö+', u: 'u', 'ü': 'ü' };

// Analysis of a syllable: initial, glide, nucleus, final, tone
function analyse(syllable) {
  const label = String(syllable).normalize('NFC').toLowerCase().trim();
  const first = label.slice(0, 1), first2 = label.slice(0, 2);
  let initial = null;
  if (INITIALS2.includes(first2)) initial = first2;
  else if (first === 'g') initial = /^g[ìíỉĩị]$/.test(label) ? 'gi' : 'g';
  else if (INITIAL1[first]) initial = INITIAL1[first];

  let tone = 0;
  for (let t = 1; t < TONES.length; t++) if (TONES[t].test(label)) { tone = t; break; }

  let nucleus = null, glide = initial === 'qu' ? 'w' : '';
  const match = VOWELS.exec(label);
  if (match) {
    let vowels = match[0];
    for (const [re, to] of VOWEL_CLASSES) vowels = vowels.replace(re, to);
    if (initial === 'qu') vowels = vowels.slice(1);
    if (initial === 'gi' && vowels !== 'i') vowels = vowels.slice(1);
    let v1 = vowels.slice(0, 1), v2 = vowels.length > 1 ? vowels.slice(0, 2) : '';
    if (v2 && ['oa', 'uâ', 'uä', 'oe', 'uê', 'uy', 'uô', 'uö'].includes(v2)) {
      vowels = vowels.slice(1).replace(/ô/g, 'â');
      v1 = vowels.slice(0, 1);
      v2 = vowels.length > 1 ? vowels.slice(0, 2) : '';
      glide = 'w';
    }
    if (v2 === 'ai' || v2 === 'ao') nucleus = 'a';
    else if (v2 === 'ay' || v2 === 'au') nucleus = 'a+';
    else if (['ia', 'iê', 'ya', 'yê'].includes(v2)) nucleus = 'i+';
    else if (v2 === 'ua' || v2 === 'uô') nucleus = 'u+';
    else if (v2 === 'üa' || v2 === 'üö') nucleus = 'ü+';
    else nucleus = NUCLEUS1[v1] ?? vowels;
  }
  if (initial === 'qu') initial = 'k';

  let final = null;
  if (label.endsWith('n')) final = 'n';
  else if (label.endsWith('m')) final = 'm';
  else if (label.endsWith('p')) final = 'p';
  else if (label.endsWith('c')) final = 'c';
  else if (label.endsWith('ch')) { final = 'c'; if (nucleus === 'a') nucleus = 'ö'; }
  else if (label.endsWith('t')) final = 't';
  else if (label.endsWith('ng')) final = 'ng';
  else if (label.endsWith('nh')) { final = 'ng'; if (nucleus === 'a') nucleus = 'ö'; }
  else if (/[iy]$/.test(label)) { if (['a', 'a+', 'o', 'o+', 'u', 'u+', 'ö', 'ö+'].includes(nucleus)) final = 'j'; }
  else if (/[ou]$/.test(label)) { if (['a', 'a+', 'e', 'e+', 'i', 'i+', 'ö', 'ö+', 'ü', 'ü+'].includes(nucleus)) final = 'w'; }
  return { initial, glide, nucleus: nucleus || '', final, tone };
}

function ipa(syllable, initials, specials, tones) {
  const info = analyse(syllable);
  let nucleus = NUCLEUS[info.nucleus] ?? info.nucleus;
  if (nucleus === '') return '';
  let final = FINAL[info.final] ?? info.final ?? '';
  const special = specials[info.nucleus + (info.final || '')];
  if (special !== undefined) { nucleus = special; final = ''; }
  const initial = initials[info.initial] ?? info.initial ?? '';
  return `${initial}${info.glide ? 'ʷ' : ''}${nucleus}${final}${tones[info.tone]}`;
}

window.ChunomIpa = {
  analyse,
  north: s => ipa(s, INITIAL_NORTH, SPECIALS_NORTH, TONE_NORTH),
  south: s => ipa(s, INITIAL_SOUTH, SPECIALS_SOUTH, TONE_SOUTH),
  fromQuocNgu(s) { return { north: this.north(s), south: this.south(s) }; },
};
})();
