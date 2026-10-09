/*
	The scanned dictionaries. Page images stay on chunom.org and are hot-linked.

	displayed page = image number - offset   (entries start at displayed page 1)
	data/<id>.json = last headword on each dictionary page, starting at displayed page 1 (used by the search)
*/

const CHUNOM = 'https://chunom.org/media/dict';

export const DICTIONARIES = {
	genibrel: {
		id: 'genibrel',
		short: 'Génibrel 1898',
		title: 'Génibrel, J.F.M., 1898',
		subtitle: 'Dictionnaire Annamite-Français',
		pageUrl: n => `${CHUNOM}/genibrel/pages/genibrel%20(${n}).jpg`,
		offset: 10,
		lastImage: 998,
		legend: [
			['[ ]', 'in Chinese (the Chinese/Hán pronunciation of a character)'],
			['( )', 'in Vietnamese (the meaning of a Chinese character in Vietnamese usage)'],
			['(T)', 'Tongkinese language (northern)'],
			['(C)', 'Hue language'],
			['V', 'see also'],
			['Id', 'same meaning'],
			['=', 'same as']
		],
		toc: [
			[-3, 'Title'],
			[-2, 'Signes et abbréviations', 'full legend'],
			[-1, 'Au lecteur'],
			[1, 'Dictionnaire Annamite-Français']
		]
	},

	bonet: {
		id: 'bonet',
		short: 'Bonet 1899',
		title: 'Bonet, Jean, 1899',
		subtitle: 'Dictionnaire Annamite-Français',
		note: 'Langue officielle et langue vulgaire',
		pageUrl: n => `${CHUNOM}/bonnet/pages/bonnet%20(${n}).png`,
		offset: 39,
		lastImage: 1032,
		legend: [
			['*', 'Chinese character'],
			['S.A.', '“Sino-Annamite” (Sino-Vietnamese, i.e. Hán-Việt)'],
			['A.V.', '“Annamite vulgaire” (the meaning of a Chinese character in Vietnamese usage)']
		],
		source: ['gallica.BnF.fr Bibliothèque Numérique', 'https://gallica.bnf.fr'],
		toc: [
			[-27, 'Title'],
			[-25, 'Preface'],
			[-21, 'Avertissement Grammatical'],
			[0, 'Signes de convention pour les abbréviations', 'full legend'],
			[1, 'Dictionnaire Annamite-Français'],
			[953, 'Notice sur les divisions politiques et administratives de l’empire Annamite'],
			[972, 'Provinces, préfectures et sous-préfectures de la Cochinchine'],
			[975, 'Nouvelles divisions administratives'],
			[977, 'Tableau des 214 clefs ou radicaux']
		]
	},

	tdcntd: {
		id: 'tdcntd',
		short: 'TĐCNTD 2009',
		title: 'Institute of Vietnamese Studies, 2009',
		subtitle: 'Từ Điển Chữ Nôm Trích Dẫn',
		note: 'Dictionary of Nôm characters with excerpts',
		pageUrl: n => `${CHUNOM}/tdcntd/${n}.jpg`,
		offset: 18,
		lastImage: 1592,
		legend: [
			['Bộ', 'radical'],
			['Nét', 'number of strokes'],
			['Âm', 'pronunciation'],
			['Ý', 'meaning']
		],
		toc: [
			[-17, 'Phạm Lệ', 'Foreword'],
			[-15, 'Cách sử dụng', 'How to use'],
			[-10, 'Lời nói đầu (phiên bản 2005)', 'Introduction, 2005 edition'],
			[-8, 'Lời nói đầu (phiên bản 2009)', 'Introduction, 2009 edition'],
			[-6, 'Nguồn tham khảo (A–C)', 'List of references'],
			[-5, 'Nguồn tham khảo (C–G)', 'List of references'],
			[-4, 'Nguồn tham khảo (H–L)', 'List of references'],
			[-3, 'Nguồn tham khảo (M–P)', 'List of references'],
			[-2, 'Nguồn tham khảo (P–S)', 'List of references'],
			[-1, 'Nguồn tham khảo (T–Tr)', 'List of references'],
			[0, 'Nguồn tham khảo (V–Y)', 'List of references'],
			[1, 'Từ điển', 'Dictionary']
		]
	}
};
