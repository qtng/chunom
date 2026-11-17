/*
	Sort keys for the headword index of the scanned dictionaries.

	Each dictionary orders Vietnamese words differently (tone order, how y / gi / ngh sort, ...),
	so every dictionary keeps its own collation, ported unchanged from the original chunom.org pages.
	collate(a) <= collate(b) compares headwords the way the printed index does (plain string comparison).
*/

function collateGenibrel(s) {
	let str = '';
	let last = '0';
	s = s.toLowerCase();
	for (let i = 0; i < s.length; i++) {
		let c = s[i];
		if (c == 'a') { c = 'a ' }
		else if (c == 'à') { c = 'a '; last = '1' }
		else if (c == 'ã') { c = 'a '; last = '2' }
		else if (c == 'ả') { c = 'a '; last = '3' }
		else if (c == 'á') { c = 'a '; last = '4' }
		else if (c == 'ạ') { c = 'a '; last = '5' }
		else if (c == 'ă') { c = 'a1' }
		else if (c == 'ằ') { c = 'a1'; last = '1' }
		else if (c == 'ẵ') { c = 'a1'; last = '2' }
		else if (c == 'ẳ') { c = 'a1'; last = '3' }
		else if (c == 'ắ') { c = 'a1'; last = '4' }
		else if (c == 'ặ') { c = 'a1'; last = '5' }
		else if (c == 'â') { c = 'a2' }
		else if (c == 'ầ') { c = 'a2'; last = '1' }
		else if (c == 'ẫ') { c = 'a2'; last = '2' }
		else if (c == 'ẩ') { c = 'a2'; last = '3' }
		else if (c == 'ấ') { c = 'a2'; last = '4' }
		else if (c == 'ậ') { c = 'a2'; last = '5' }
		else if (c == 'e') { c = 'e ' }
		else if (c == 'è') { c = 'e '; last = '1' }
		else if (c == 'ẽ') { c = 'e '; last = '2' }
		else if (c == 'ẻ') { c = 'e '; last = '3' }
		else if (c == 'é') { c = 'e '; last = '4' }
		else if (c == 'ẹ') { c = 'e '; last = '5' }
		else if (c == 'ê') { c = 'e1' }
		else if (c == 'ề') { c = 'e1'; last = '1' }
		else if (c == 'ễ') { c = 'e1'; last = '2' }
		else if (c == 'ể') { c = 'e1'; last = '3' }
		else if (c == 'ế') { c = 'e1'; last = '4' }
		else if (c == 'ệ') { c = 'e1'; last = '5' }
		else if (c == 'i') { c = 'i ' }
		else if (c == 'ì') { c = 'i '; last = '1' }
		else if (c == 'ĩ') { c = 'i '; last = '2' }
		else if (c == 'ỉ') { c = 'i '; last = '3' }
		else if (c == 'í') { c = 'i '; last = '4' }
		else if (c == 'ị') { c = 'i '; last = '5' }
		else if (c == 'o') { c = 'o ' }
		else if (c == 'ò') { c = 'o '; last = '1' }
		else if (c == 'õ') { c = 'o '; last = '2' }
		else if (c == 'ỏ') { c = 'o '; last = '3' }
		else if (c == 'ó') { c = 'o '; last = '4' }
		else if (c == 'ọ') { c = 'o '; last = '5' }
		else if (c == 'ô') { c = 'o1' }
		else if (c == 'ồ') { c = 'o1'; last = '1' }
		else if (c == 'ỗ') { c = 'o1'; last = '2' }
		else if (c == 'ổ') { c = 'o1'; last = '3' }
		else if (c == 'ố') { c = 'o1'; last = '4' }
		else if (c == 'ộ') { c = 'o1'; last = '5' }
		else if (c == 'ơ') { c = 'o2' }
		else if (c == 'ờ') { c = 'o2'; last = '1' }
		else if (c == 'ỡ') { c = 'o2'; last = '2' }
		else if (c == 'ở') { c = 'o2'; last = '3' }
		else if (c == 'ớ') { c = 'o2'; last = '4' }
		else if (c == 'ợ') { c = 'o2'; last = '5' }
		else if (c == 'u') { c = 'u ' }
		else if (c == 'ù') { c = 'u '; last = '1' }
		else if (c == 'ũ') { c = 'u '; last = '2' }
		else if (c == 'ủ') { c = 'u '; last = '3' }
		else if (c == 'ú') { c = 'u '; last = '4' }
		else if (c == 'ụ') { c = 'u '; last = '5' }
		else if (c == 'ư') { c = 'u1' }
		else if (c == 'ừ') { c = 'u1'; last = '1' }
		else if (c == 'ữ') { c = 'u1'; last = '2' }
		else if (c == 'ử') { c = 'u1'; last = '3' }
		else if (c == 'ứ') { c = 'u1'; last = '4' }
		else if (c == 'ự') { c = 'u1'; last = '5' }
		else if (c == 'y') { c = 'i1' }
		else if (c == 'ỳ') { c = 'i1'; last = '1' }
		else if (c == 'ỹ') { c = 'i1'; last = '2' }
		else if (c == 'ỷ') { c = 'i1'; last = '3' }
		else if (c == 'ý') { c = 'i1'; last = '4' }
		else if (c == 'ỵ') { c = 'i1'; last = '5' }
		else c = c + ' ';
		str = str + c;
	}
	str = str.replace(/^đ /, 'd2');
	str = str.replace(/^d /, 'd1');
	str = str.replace(/^c h /, 'c2');
	str = str.replace(/^c /, 'c1');
	str = str.replace(/^k h /, 'k2');
	str = str.replace(/^k /, 'k1');
	str = str.replace(/^n h /, 'n3');
	str = str.replace(/^n g /, 'n2');
	str = str.replace(/^n /, 'n1');
	str = str.replace(/^t r /, 't3');
	str = str.replace(/^t h /, 't2');
	str = str.replace(/^t /, 't1');
	return str + last;
}

function collateBonet(s) {
	let str = '';
	let dia = '0';
	let last = '0';
	s = s.toLowerCase();
	for (let i = 0; i < s.length; i++) {
		let c = s[i];
		if (c == 'a') { c = 'a ' }
		else if (c == 'ạ') { c = 'a '; last = '1' }
		else if (c == 'á') { c = 'a '; last = '2' }
		else if (c == 'à') { c = 'a '; last = '3' }
		else if (c == 'ã') { c = 'a '; last = '4' }
		else if (c == 'ả') { c = 'a '; last = '5' }
		else if (c == 'ă') { c = 'a '; dia = '1'; }
		else if (c == 'ặ') { c = 'a '; dia = '1'; last = '1' }
		else if (c == 'ắ') { c = 'a '; dia = '1'; last = '2' }
		else if (c == 'ằ') { c = 'a '; dia = '1'; last = '3' }
		else if (c == 'ẵ') { c = 'a '; dia = '1'; last = '4' }
		else if (c == 'ẳ') { c = 'a '; dia = '1'; last = '5' }
		else if (c == 'â') { c = 'a '; dia = '2'; }
		else if (c == 'ậ') { c = 'a '; dia = '2'; last = '1' }
		else if (c == 'ấ') { c = 'a '; dia = '2'; last = '2' }
		else if (c == 'ầ') { c = 'a '; dia = '2'; last = '3' }
		else if (c == 'ẫ') { c = 'a '; dia = '2'; last = '4' }
		else if (c == 'ẩ') { c = 'a '; dia = '2'; last = '5' }
		else if (c == 'e') { c = 'e ' }
		else if (c == 'ẹ') { c = 'e '; last = '1' }
		else if (c == 'é') { c = 'e '; last = '2' }
		else if (c == 'è') { c = 'e '; last = '3' }
		else if (c == 'ẽ') { c = 'e '; last = '4' }
		else if (c == 'ẻ') { c = 'e '; last = '5' }
		else if (c == 'ê') { c = 'e '; dia = '1'; }
		else if (c == 'ệ') { c = 'e '; dia = '1'; last = '1' }
		else if (c == 'ế') { c = 'e '; dia = '1'; last = '2' }
		else if (c == 'ề') { c = 'e '; dia = '1'; last = '3' }
		else if (c == 'ễ') { c = 'e '; dia = '1'; last = '4' }
		else if (c == 'ể') { c = 'e '; dia = '1'; last = '5' }
		else if (c == 'i') { c = 'i1' }
		else if (c == 'ị') { c = 'i1'; last = '1' }
		else if (c == 'í') { c = 'i1'; last = '2' }
		else if (c == 'ì') { c = 'i1'; last = '3' }
		else if (c == 'ĩ') { c = 'i1'; last = '4' }
		else if (c == 'ỉ') { c = 'i1'; last = '5' }
		else if (c == 'y' && i == 0) { c = 'i2' }
		else if (c == 'ỵ' && i == 0) { c = 'i2'; last = '1' }
		else if (c == 'ý' && i == 0) { c = 'i2'; last = '2' }
		else if (c == 'ỳ' && i == 0) { c = 'i2'; last = '3' }
		else if (c == 'ỹ' && i == 0) { c = 'i2'; last = '4' }
		else if (c == 'ỷ' && i == 0) { c = 'i2'; last = '5' }
		else if (c == 'y') { c = 'i1'; dia = '1'; }
		else if (c == 'ỵ') { c = 'i1'; dia = '1'; last = '1' }
		else if (c == 'ý') { c = 'i1'; dia = '1'; last = '2' }
		else if (c == 'ỳ') { c = 'i1'; dia = '1'; last = '3' }
		else if (c == 'ỹ') { c = 'i1'; dia = '1'; last = '4' }
		else if (c == 'ỷ') { c = 'i1'; dia = '1'; last = '5' }
		else if (c == 'o') { c = 'o ' }
		else if (c == 'ọ') { c = 'o '; last = '1' }
		else if (c == 'ó') { c = 'o '; last = '2' }
		else if (c == 'ò') { c = 'o '; last = '3' }
		else if (c == 'õ') { c = 'o '; last = '4' }
		else if (c == 'ỏ') { c = 'o '; last = '5' }
		else if (c == 'ô') { c = 'o '; dia = '1'; }
		else if (c == 'ộ') { c = 'o '; dia = '1'; last = '1' }
		else if (c == 'ố') { c = 'o '; dia = '1'; last = '2' }
		else if (c == 'ồ') { c = 'o '; dia = '1'; last = '3' }
		else if (c == 'ỗ') { c = 'o '; dia = '1'; last = '4' }
		else if (c == 'ổ') { c = 'o '; dia = '1'; last = '5' }
		else if (c == 'ơ') { c = 'o '; dia = '2'; }
		else if (c == 'ợ') { c = 'o '; dia = '2'; last = '1' }
		else if (c == 'ớ') { c = 'o '; dia = '2'; last = '2' }
		else if (c == 'ờ') { c = 'o '; dia = '2'; last = '3' }
		else if (c == 'ỡ') { c = 'o '; dia = '2'; last = '4' }
		else if (c == 'ở') { c = 'o '; dia = '2'; last = '5' }
		else if (c == 'u') { c = 'u ' }
		else if (c == 'ụ') { c = 'u '; last = '1' }
		else if (c == 'ú') { c = 'u '; last = '2' }
		else if (c == 'ù') { c = 'u '; last = '3' }
		else if (c == 'ũ') { c = 'u '; last = '4' }
		else if (c == 'ủ') { c = 'u '; last = '5' }
		else if (c == 'ư') { c = 'u '; dia = '1'; }
		else if (c == 'ự') { c = 'u '; dia = '1'; last = '1' }
		else if (c == 'ứ') { c = 'u '; dia = '1'; last = '2' }
		else if (c == 'ừ') { c = 'u '; dia = '1'; last = '3' }
		else if (c == 'ữ') { c = 'u '; dia = '1'; last = '4' }
		else if (c == 'ử') { c = 'u '; dia = '1'; last = '4' }
		else if (c == 'đ') { c = 'd1' }
		else if (c == 'd') { c = 'd2' }
		else c = c + ' ';
		str = str + c;
	}
	str = str.replace(/^n a/, 'n1a');
	str = str.replace(/^n e/, 'n1e');
	str = str.replace(/^n g/, 'n2');
	str = str.replace(/^n h/, 'n3');
	str = str.replace(/^n /, 'n3');
	return str + dia + last;
}

function collateTdcntd(s) {
	let str = '';
	let last = '0';
	s = s.toLowerCase();
	for (let i = 0; i < s.length; i++) {
		let c = s[i];
		if (c == 'a') { c = 'a ' }
		else if (c == 'á') { c = 'a '; last = '1' }
		else if (c == 'à') { c = 'a '; last = '2' }
		else if (c == 'ả') { c = 'a '; last = '3' }
		else if (c == 'ã') { c = 'a '; last = '4' }
		else if (c == 'ạ') { c = 'a '; last = '5' }
		else if (c == 'ă') { c = 'a1' }
		else if (c == 'ắ') { c = 'a1'; last = '1' }
		else if (c == 'ằ') { c = 'a1'; last = '2' }
		else if (c == 'ẳ') { c = 'a1'; last = '3' }
		else if (c == 'ẵ') { c = 'a1'; last = '4' }
		else if (c == 'ặ') { c = 'a1'; last = '5' }
		else if (c == 'â') { c = 'a2' }
		else if (c == 'ấ') { c = 'a2'; last = '1' }
		else if (c == 'ầ') { c = 'a2'; last = '2' }
		else if (c == 'ẩ') { c = 'a2'; last = '3' }
		else if (c == 'ẫ') { c = 'a2'; last = '4' }
		else if (c == 'ậ') { c = 'a2'; last = '5' }
		else if (c == 'e') { c = 'e ' }
		else if (c == 'é') { c = 'e '; last = '1' }
		else if (c == 'è') { c = 'e '; last = '2' }
		else if (c == 'ẻ') { c = 'e '; last = '3' }
		else if (c == 'ẽ') { c = 'e '; last = '4' }
		else if (c == 'ẹ') { c = 'e '; last = '5' }
		else if (c == 'ê') { c = 'e1' }
		else if (c == 'ế') { c = 'e1'; last = '1' }
		else if (c == 'ề') { c = 'e1'; last = '2' }
		else if (c == 'ể') { c = 'e1'; last = '3' }
		else if (c == 'ễ') { c = 'e1'; last = '4' }
		else if (c == 'ệ') { c = 'e1'; last = '5' }
		else if (c == 'i') { c = 'i ' }
		else if (c == 'í') { c = 'i '; last = '1' }
		else if (c == 'ì') { c = 'i '; last = '2' }
		else if (c == 'ỉ') { c = 'i '; last = '3' }
		else if (c == 'ĩ') { c = 'i '; last = '4' }
		else if (c == 'ị') { c = 'i '; last = '5' }
		else if (c == 'o') { c = 'o ' }
		else if (c == 'ó') { c = 'o '; last = '1' }
		else if (c == 'ò') { c = 'o '; last = '2' }
		else if (c == 'ỏ') { c = 'o '; last = '3' }
		else if (c == 'õ') { c = 'o '; last = '4' }
		else if (c == 'ọ') { c = 'o '; last = '5' }
		else if (c == 'ô') { c = 'o1' }
		else if (c == 'ố') { c = 'o1'; last = '1' }
		else if (c == 'ồ') { c = 'o1'; last = '2' }
		else if (c == 'ổ') { c = 'o1'; last = '3' }
		else if (c == 'ỗ') { c = 'o1'; last = '4' }
		else if (c == 'ộ') { c = 'o1'; last = '5' }
		else if (c == 'ơ') { c = 'o2' }
		else if (c == 'ớ') { c = 'o2'; last = '1' }
		else if (c == 'ờ') { c = 'o2'; last = '2' }
		else if (c == 'ở') { c = 'o2'; last = '3' }
		else if (c == 'ỡ') { c = 'o2'; last = '4' }
		else if (c == 'ợ') { c = 'o2'; last = '5' }
		else if (c == 'u') { c = 'u ' }
		else if (c == 'ú') { c = 'u '; last = '1' }
		else if (c == 'ù') { c = 'u '; last = '2' }
		else if (c == 'ủ') { c = 'u '; last = '3' }
		else if (c == 'ũ') { c = 'u '; last = '4' }
		else if (c == 'ụ') { c = 'u '; last = '5' }
		else if (c == 'ư') { c = 'u1' }
		else if (c == 'ứ') { c = 'u1'; last = '1' }
		else if (c == 'ừ') { c = 'u1'; last = '2' }
		else if (c == 'ử') { c = 'u1'; last = '3' }
		else if (c == 'ữ') { c = 'u1'; last = '4' }
		else if (c == 'ự') { c = 'u1'; last = '5' }
		else if (c == 'y') { c = 'y1' }
		else if (c == 'ý') { c = 'y1'; last = '1' }
		else if (c == 'ỳ') { c = 'y1'; last = '2' }
		else if (c == 'ỷ') { c = 'y1'; last = '3' }
		else if (c == 'ỹ') { c = 'y1'; last = '4' }
		else if (c == 'ỵ') { c = 'y1'; last = '5' }
		else c = c + ' ';
		str = str + c;
	}
	str = str.replace(/^đ /, 'd2');
	str = str.replace(/^d /, 'd1');
	str = str.replace(/^c h /, 'c2');
	str = str.replace(/^c /, 'c1');
	str = str.replace(/^g (i\d? )$/, 'g1$1');
	str = str.replace(/^g (i\d? n )$/, 'g1$1');
	str = str.replace(/^g i /, 'g3');
	str = str.replace(/^g h /, 'g2');
	str = str.replace(/^g /, 'g1');
	str = str.replace(/^k h /, 'k2');
	str = str.replace(/^k /, 'k1');
	str = str.replace(/^n h /, 'n4');
	str = str.replace(/^n g h /, 'n3');
	str = str.replace(/^n g /, 'n2');
	str = str.replace(/^n /, 'n1');
	str = str.replace(/^t r /, 't3');
	str = str.replace(/^t h /, 't2');
	str = str.replace(/^t /, 't1');
	return str + last;
}

export const COLLATORS = { genibrel: collateGenibrel, bonet: collateBonet, tdcntd: collateTdcntd };
