/*
	VietIME Extension for jQuery

// Increment to wipe permanent cache
var CACHEVERSION = '2017-11-22';

(function($) {
	/**
	 * Initializes a new instance of the VietUni class.
	 *
	 * @param int mode  Vietnamese typing method: 1=telex, 2=vni, 3=viqr, 4=all(default), 5=compound telex, otherwise=off
	 */
	function vietUni(mode) {
	  if (document.all || document.getElementById) {
	    this.lookback = 30;
	    this.defaultmode = 1;
	    this.method = (mode == undefined || mode == null) ? this.defaultmode : mode;
	    return this;
	  }
	  alert("Xin loi, trinh duyet web cua ban khong cho phep dung VietTyping.");
	  return false;
	}

	/**
	 * Sets Vietnamese typing method
	 */
	vietUni.prototype.setMethod = function(mode) {
	  this.method = mode;
	  if (this.typer) this.typer.keyMode = this.initKeys();
	};

	vietUni.prototype.initKeys = function() {
	  switch (this.method) {
	    case 1:
	      if (!this.telexKeys) this.telexKeys = new vietKeysTelex();
	      return this.telexKeys;

	    case 2:
	      if (!this.vniKeys) this.vniKeys = new vietKeysVni();
	      return this.vniKeys;

	    case 3:
	      if (!this.viqrKeys) this.viqrKeys = new vietKeysViqr();
	      return this.viqrKeys;

	    case 4:
	      if (!this.allKeys) this.allKeys = new vietKeysAll();
	      return this.allKeys;

	    case 5:
	      if (!this.compoundTelexKeys) this.compoundTelexKeys = new vietKeysCompoundTelex();
	      return this.compoundTelexKeys;
	      
	    default:
	      if (!this.vkOff) this.vkOff = new vietKeysOff();
	      return this.vkOff;
	  }
	};

	/**
	 * Initializes Vietnamese typer for an editable element (textbox, textarea, iframe.document)
	 */
	vietUni.prototype.initTyper = function(el) {
	  // validates parameters
	  if (!el) return;

	  if (!this.typer) {
	    this.typer = new vietTyper();
	    this.typer.keyMode = this.initKeys();
	  }

	  var self = this;
	  if (el.attachEvent) {
	    el.attachEvent("onkeypress", function(evt) {
	      return vietUni.vietTyping(evt, self, el);
	    });
	  }
	  else if (el.addEventListener) {
	    el.addEventListener("keypress", function(evt) {
	      return vietUni.vietTyping(evt, self, el);
	    }, true);
	  }
	  else if (el.onkeypress) {
	    var oldFunc = el.onkeypress;
	    if (typeof oldFunc !== "function") {
	      el.onkeypress = function(evt) {
	        return vietUni.vietTyping(evt, self, el);
	      };
	    }
	    else {
	      el.onkeypress = function(evt) {
	        return (!oldFunc(evt)) ? false : vietUni.vietTyping(evt, self, el);
	      };
	    }
	  }
	};

	/**
	 * Handles key-press event of the editable element
	 */
	vietUni.vietTyping = function(evt, vUni, el) {
	  // validates parameters
	  if (!vUni || vUni.typer.keyMode.off) return true;

	  // event fixing
	  if (!evt) evt = event;

	  // retrieves pressed key code
	  var c = document.all ? evt.keyCode : (evt.which || evt.charCode);
	  // out of typeable keys range
	  if (c < 49 && c != 16 && c != 20) return true;

	  // retrieves the current word
	  var len, s = vUni.getCurrentWord(el);
	  if (s == null || (len = s.length) < 1 || s.match(/\s+$/)) return true;

	  // replaces with Vietnamese word
	  vUni.typer.value = s;
	  if (c > 32 && vUni.typer.typing(c)) {
	    // found an increment of the word length
	    if (((s = vUni.typer.value).length == len + 1) && c == s.charCodeAt(len)) {
	      // fixs length of the replacement word
	      vUni.typer.value = s.substr(0, len);
	      len = 0;
	    }
	    vUni.replaceWord(el, vUni.typer.value);

	    // cancels the current key
	    if (len > 0) {
	      if (typeof evt.cancelBubble !== "undefined") {
	        evt.cancelBubble = true;
	      }
	      if (evt.stopPropagation) {
	        evt.preventDefault();
	        evt.stopPropagation();
	      }
	      return false;
	    }
	  }

	  return (!evt.cancelBubble);
	};

	vietUni.prototype.getCurrentWord = function(el) {
	  // for IE / Opera textbox
	  if (document.selection && !el.createRange) {
	    var caret = (!el.selection) ? el.document.selection.createRange() : el.selection.createRange();
	    // is selected ?
	    if (caret.text) return null;

	    var caret2;
	    try {
	      caret2 = caret.duplicate();
	      caret2.moveStart("word", -1);
	    } catch(e) {
	      var backward = -this.lookback;
	      do {
	        caret2 = caret.duplicate();
	        caret2.moveStart("character", backward++);
	      }
	      while (!caret2.text && backward < 0);
	    }

	    el.curWord = caret2.duplicate();

	    return caret2.text;
	  }
	  // for Firefox textbox
	  else if (el.setSelectionRange) {
	    var p1 = el.selectionStart, p2 = el.selectionEnd;
	    // is selected ?
	    if (p1 != p2) return null;

	    p1 = Math.max(0, p2 - this.lookback);
	    el.pos1 = p1;
	    el.pos2 = p2;

	    return el.value.substr(p1, p2 - p1);
	  }
	  // for Firefox / Opera iframe.document
	  else if (window.getSelection) {
	    var sel = el.defaultView.getSelection();
	    var rng = sel.getRangeAt(sel.rangeCount - 1).cloneRange();

	    // is selected ?
	    if (rng.toString()) return null;

	    // get neareat word
	    var p2 = rng.startOffset, nod = rng.endContainer;
	    rng.setEnd(nod, p2);
	    rng.setStart(nod, Math.max(0, p2 - this.lookback));

	    // store current word
	    el.rng1 = rng;
	    el.nod1 = nod;
	    el.pos1 = rng.startOffset;
	    el.pos2 = p2;

	    var txt = rng.toString();
	    // restore caret position
	    rng.setStart(nod, p2);

	    return txt;
	  }
	  else if (typeof el.value !== "undefined") {
	    return el.value;
	  }

	  return null;
	};

	vietUni.prototype.replaceWord = function(el, newWord) {
	  // for IE / Opera textbox
	  if (document.selection && !el.createRange && el.curWord) {
	    el.curWord.text = newWord;
	    el.curWord.collapse(false);
	  }
	  // for Firefox textbox
	  else if (el.setSelectionRange) {
	    var p1 = el.pos1, p2 = el.pos2, txt = el.value;
	    el.value = txt.substr(0, p1) + newWord + txt.substr(p2);
	    //
	    el.setSelectionRange(p1 + newWord.length, p1 + newWord.length);
	  }
	  // for Firefox / Opera iframe.document
	  else if (window.getSelection && el.nod1 && el.nod1.insertData) {
	    el.rng1.setStart(el.nod1, el.pos1);
	    el.nod1.insertData(el.pos1, newWord);
	    el.nod1.deleteData(el.pos1 + newWord.length, el.pos2 - el.pos1);

	    // move cursor to the end
	    el.rng1.setEnd(el.nod1, el.pos2);
	    el.rng1.setStart(el.nod1, el.pos2);
	  }
	  else if (typeof el.value !== "undefined") {
	    el.value = newWord;
	  }
	};

	/*---------- VietTyper class ----------*/
	function vietTyper() {
	  this.value = "";
	  this.charMap = new vietUnicodeMap();
	  this.ctrlChar = '-';
	  this.changed = 0;
	  return this;
	}

	vietTyper.prototype.typing = function(ctrl) {
	  //if (this.keyMode.off) return 0;
	  this.changed = 0;
	  this.ctrlChar = String.fromCharCode(ctrl);
	  this.keyMode.getAction(this);

	  this.correct();
	  return this.changed;
	};

	vietTyper.prototype.compose = function(typ) {
	  if (!this.value) return;

	  var info = this.findCharToChange(typ);
	  if (!info || !info[0]) return;

	  var telex;
	  if (info[0] == '\\') {
	    telex = [1, this.ctrlChar, 1];
	  }
	  else if (typ > 6) {
	    telex = this.charMap.getAEOWD(info[0], typ, info[3]);
	  }
	  else {
	    telex = this.charMap.getDau(info[0], typ);
	  }
	  if (!(this.changed = telex[0])) return;

	  // replace a character at info[1]
	  this.value = this.value.substr(0, info[1]) + telex[1] + this.value.substr(info[1] + info[2]);

	  // spell error
	  if (!telex[2]) this.value += this.ctrlChar;
	};

	vietTyper.prototype.correct = function() {
	  //if (!document.all) return 0;
	  var val = this.value;
	  if ('nNcC'.indexOf(this.ctrlChar) >= 0) val += this.ctrlChar;

	  var er = /[^\x01-\x7f](gn)$/i.exec(val);
	  if (er) {
	    this.value = val.substr(0, val.length - 2) + er[1].charAt(1) + er[1].charAt(0);
	    this.changed = 1;
	  }
	  else if (!this.changed) {
	    return 0;
	  }

	  /* For chaining syllables into compounds this is not useful
	  er = /\w([^\x01-\x7f])(\w*)([^\x01-\x7f])\S*$/.exec(this.value);
	  if (!er) return 0;

	  var i = this.charMap.isVowel(er[1]);
	  var ri = (i - 1) % 24 + 1, ci = (i - ri) / 24;
	  var i2 = this.charMap.isVowel(er[3]);
	  if (!ci || !i2) return 0;

	  var ri2 = (i2 - 1) % 24 + 1;
	  var nc = this.charMap.charAt(ri) + er[2] + this.charMap.charAt(ci * 24 + ri2);

	  this.value = this.value.replace(new RegExp(er[1] + er[2] + er[3], 'g'), nc);
	  */
	};

	vietTyper.prototype.findCharToChange = function(typ) {
	  var lastChars = this.charMap.lastCharsOf(this.value, 5);
	  //
	  var i = 0, c = lastChars[0][0], chr = 0;
	  if (c == '\\') return [c, this.value.length - 1, 1];

	  if (typ == 15) {
	    if (!(chr = this.charMap.isVD(c))) {
		return null;
	    }
	  } else {
	    while ("cghmnptCGHMNPT".indexOf(c) >= 0) {
	      if ((c < 'A') || (i >= 3) || !(c = lastChars[++i][0])) return null;
	    }
	  }
	  c = lastChars[0][0].toLowerCase();

	  var pc = lastChars[1][0].toLowerCase();
	  var ppc = lastChars[2][0].toLowerCase();
	  var pppc = lastChars[3][0].toLowerCase();
	  
	  if (i > 0 && typ > 8) return null;
	  
	  if (i > 0) {
		if (c == 'h' && this.charMap.isUO(pppc, ppc)) {
			i+=1; // Compound Telex
		} else if (c == 'h' && this.charMap.isAyhAuhUuhUahUihOih(ppc, pc)) {
			i+=1; // Compound Telex
			chr = this.charMap.isVowel(ppc);
		} else if (this.charMap.isAeEiOu(ppc, pc)) {
			i+=1; // Compound Telex
			chr = this.charMap.isVowel(ppc);
		}
	  } else if (i == 0 && typ != 15) {
	    if (this.charMap.isAeEiOu(ppc, pc)) {
		i += 2; // Compound Telex
		chr = this.charMap.isVowel(ppc);
	    } else if (this.charMap.isAeEiOu(pc, c)) {
		i++; // Compound Telex
	    } else {
		chr = this.charMap.isVowel(lastChars[1][0])
		if ((chr) && ("uyoia".indexOf(c) >= 0)
			&& !this.charMap.isUO(pc, c) && !((pc == 'o' && c == 'a') || (pc == 'u' && c == 'y'))
			&& !((ppc == 'q' && pc == 'u') || (ppc == 'g' && pc == 'i'))) i++;
	    }

	    if (c == 'a' && (typ == 9 || typ == 7)) i = 0;
	  }
	  c = lastChars[i][0];

	  if ((i == 0 || chr == 0) && typ != 15) chr = this.charMap.isVowel(c);
	  if (!chr) return null;

	  var clen = lastChars[i][1], isuo = 0;
	  //
	  if ((i > 0) && (typ == 7 || typ == 8 || typ == 11)) {
	    isuo = this.charMap.isUO(lastChars[i + 1][0], c);
	    if (isuo) {
	      chr = isuo;
	      clen += lastChars[++i][1];
	      isuo = 1;
	    }
	  }

	  var pos = this.value.length;
	  for (var j = 0; j <= i; j++) pos -= lastChars[j][1];
	  return [chr, pos, clen, isuo];
	};
	/*---------- End of VietTyper class ----------*/

	/*---------- VietCharMap class ----------*/
	function vietCharMap() {
	  // properties
	  this.vietChars = null;
	  this.length = 149;
	  this.chrCache = new Array(20);
	  this.indCache = new Array(20);
	  this.cptr = 0;
	  // methods
	  this.caching = function(chr, ind) {
	    this.chrCache[this.cptr] = chr;
	    this.indCache[this.cptr++] = ind;
	    this.cptr %= 20;
	  };
	  // constants
	  this.vmap = [[7, 7, 7, 8, 8, 8, 9, 10, 11, 15],
		    [0, 3, 6, 0, 6, 9, 0, 3, 6, 0],
		    [1, 4, 7, 2, 8, 10, 1, 4, 7, 1]];
	  return this;
	}

	vietCharMap.prototype.charAt = function(ind) {
	  var chrCode = this.vietChars[ind];

	  return chrCode ? String.fromCharCode(chrCode) : null;
	};

	vietCharMap.prototype.isVowel = function(chr) {
	  var i = 0;
	  while ((i < 20) && (chr != this.chrCache[i])) i++;

	  if (i < 20) return this.indCache[i];

	  i = this.length - 5;
	  while ((chr != this.charAt(i)) && i) i--;

	  this.caching(chr, i);

	  return i;
	};

	vietCharMap.prototype.isVD = function(chr) {
	  var ind = this.length - 5;

	  while ((chr != this.charAt(ind)) && (ind < this.length)) ind++;

	  return (ind < this.length) ? ind: 0;
	};

	vietCharMap.prototype.isAyhAuhUuhUahUihOih = function(c1, c2) {
	  if (!c1 || !c2) return 0;

	  var ind1 = this.isVowel(c1);
	  var ci1 = (ind1 - 1) % 12;

	  var ind2 = this.isVowel(c2);
	  var ci2 = (ind2 - 1) % 12;

	  if (!((ci1 == 0 && ci2 == 9) || (ci1 == 0 && ci2 == 11) || (ci1 == 9 && ci2 == 9)
		|| (ci1 == 9 && ci2 == 0) || (ci1 == 9 && ci2 == 5) || (ci1 == 6 && ci2 == 5))) return 0;

	  return [ind1, ind2];
	};

	vietCharMap.prototype.isAeEiOu = function(c1, c2) {
	  if (!c1 || !c2) return 0;

	  var ind1 = this.isVowel(c1);
	  var ci1 = (ind1 - 1) % 12;

	  var ind2 = this.isVowel(c2);
	  var ci2 = (ind2 - 1) % 12;

	  if (!((ci1 == 0 && ci2 == 3) || (ci1 == 3 && ci2 == 5) || (ci1 == 6 && ci2 == 9))) return 0;

	  return [ind1, ind2];
	};

	vietCharMap.prototype.isUO = function(c1, c2) {
	  if (!c1 || !c2) return 0;

	  var ind1 = this.isVowel(c1);
	  var ci = (ind1 - 1) % 12;
	  if ((ci != 9) && (ci != 10)) return 0;

	  var ind2 = this.isVowel(c2);
	  ci = (ind2 - 1) % 12;
	  if ((ci != 6) && (ci != 7) && (ci != 8)) return 0;

	  return [ind1, ind2];
	};

	vietCharMap.prototype.getDau = function(ind, typ) {
	  var accented = (ind < 25) ? 0: 1;
	  var indI = (ind - 1) % 24 + 1;
	  var charSet = (typ == 6) ? 0: typ;

	  if ((typ == 6) && !accented) return [0];

	  var newInd = charSet * 24 + indI;
	  if (newInd == ind) newInd = indI;

	  var chr = this.charAt(newInd);
	  if (!chr) chr = this.lowerCaseOf(0, newInd);

	  return [1, chr, newInd > 24 || typ == 6];
	};

	vietCharMap.prototype.getAEOWD = function(ind, typ, isuo) {
	  var c = 0, i1 = isuo ? ind[0] : ind;
	  var vc1 = (typ == 15) ? (i1 - 1) % 2 : (i1 - 1) % 12;

	  if (isuo) {
	    var base = ind[1] - (ind[1] - 1) % 12;

	    if (typ == 7 || typ == 11) {
	      c = this.charAt(i1 - vc1 + 9) + this.charAt(base + 7);
	    }
	    else if (typ == 8) {
	      c = this.charAt(i1 - vc1 + 10) + this.charAt(base + 8);
	    }

	    return [c != 0, c, 1];
	  }

	  var i = -1, shif = 0, del = 0;

	  while (shif == 0 && ++i < this.vmap[0].length) {
	    if (this.vmap[0][i] == typ) {
	      if (this.vmap[1][i] == vc1) {
	        shif = this.vmap[2][i] - vc1;
	      }
	      else if (this.vmap[2][i] == vc1) {
	        shif = this.vmap[1][i] - vc1;
	      }
	    }
	  }

	  if (shif == 0) {
	    if (typ == 7 && (vc1 == 2 || vc1 == 8)) shif = -1;
	    else if ((typ == 9 && vc1 == 2) || (typ == 11 && vc1 == 8)) shif = -1;
	    else if (typ == 8 && (vc1 == 1 || vc1 == 7)) shif = 1;

	    del = 1;
	  }
	  else {
	    del = (shif > 0);
	  }

	  i1 += shif;
	  var chr = this.charAt(i1);

	  if (i1 < 145) this.caching(chr, i1);
	  if (!chr) chr = this.lowerCaseOf(0, i1);

	  return [shif != 0, chr, del];
	};

	vietCharMap.prototype.lastCharsOf = function(str, len) {
	  if (!len) return [str.charAt(str.length - 1), 1];

	  var vchars = new Array(len);
	  for (var i = 0; i < len; i++) {
	    vchars[i] = [str.charAt(str.length - i - 1), 1];
	  }
	  return vchars;
	};
	/*---------- End of VietCharMap class ----------*/

	/*---------- VietUnicodeMap class ----------*/
	function vietUnicodeMap() {
	  var vcmap = new vietCharMap();
	  /*
		a  a^  a(  e  a^  i  o  o^  o+  u  u+  y --> no tone (12 letters)
		A  A^  A(  E  A^  I  O  O^  O+  U  U+  Y
		a' a^' a(' e' a^' i' o' o^' o+' u' u+' y --> tone 1
		A' A^' A(' E' A^' I' O' O^' O+' U' U+' Y
		...
		... and so on with tones in this order: / \ . ? ~
		... total 12 vowel lines plus one dDdD-line
		...
		d  d-  D  D-
	  */
	  vcmap.vietChars = new Array("UNICODE", 97, 226, 259, 101, 234, 105, 111, 244,
	    417, 117, 432, 121, 65, 194, 258, 69, 202, 73, 79, 212, 416, 85, 431, 89,
	    225, 7845, 7855, 233, 7871, 237, 243, 7889, 7899, 250, 7913, 253, 193,
	    7844, 7854, 201, 7870, 205, 211, 7888, 7898, 218, 7912, 221, 224, 7847,
	    7857, 232, 7873, 236, 242, 7891, 7901, 249, 7915, 7923, 192, 7846, 7856,
	    200, 7872, 204, 210, 7890, 7900, 217, 7914, 7922, 7841, 7853, 7863, 7865,
	    7879, 7883, 7885, 7897, 7907, 7909, 7921, 7925, 7840, 7852, 7862, 7864,
	    7878, 7882, 7884, 7896, 7906, 7908, 7920, 7924, 7843, 7849, 7859, 7867,
	    7875, 7881, 7887, 7893, 7903, 7911, 7917, 7927, 7842, 7848, 7858, 7866,
	    7874, 7880, 7886, 7892, 7902, 7910, 7916, 7926, 227, 7851, 7861, 7869,
	    7877, 297, 245, 7895, 7905, 361, 7919, 7929, 195, 7850, 7860, 7868, 7876,
	    296, 213, 7894, 7904, 360, 7918, 7928, 100, 273, 68, 272);
	  return vcmap;
	}
	/*---------- End of VietUnicodeMap class ----------*/

	/*---------- VietKeys classes ----------*/
	function vietKeys() {
	  this.getAction = function(typer) {
	    var i = this.keys.indexOf(typer.ctrlChar.toLowerCase());
	    if (i >= 0) typer.compose(this.actions[i]);
	  };
	  return this;
	}
	function vietKeysOff() {
	  this.off = true;
	  this.getAction = function(typer) {};
	  return this;
	}

	function vietKeysTelex() {
	  var k = new vietKeys();
	  k.keys = "sfjrxzaeowd";
	  k.actions = [1, 2, 3, 4, 5, 6, 9, 10, 11, 8, 15];
	  return k;
	}
	function vietKeysCompoundTelex() {
	  var k = new vietKeys();
	//  k.keys = "sfjrxzd";
	//  k.actions = [1, 2, 3, 4, 5, 6, 15];
	  k.keys = "sfjrxzd";
	  k.actions = [1, 2, 3, 4, 5, 6, 15];
	  return k;
	}
	function vietKeysVni() {
	  var k = new vietKeys();
	  k.keys = "0123456789";
	  k.actions = [6, 1, 2, 4, 5, 3, 7, 8, 8, 15];
	  return k;
	}
	function vietKeysViqr() {
	  var k = new vietKeys();
	  k.keys = "\xB4/'\u2019`.?~-^(*+d";
	  k.actions = [1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 15];
	  return k;
	}
	function vietKeysAll() {
	  var k = new vietKeys();
	  k.keys = "sfjrxzaeowd0123456789\xB4/'`.?~-^(*+d";
	  k.actions = [1, 2, 3, 4, 5, 6, 9, 10, 11, 8, 15, 6, 1, 2, 4, 5, 3, 7, 8, 8,
		    15, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 15];
	  return k;
	}
	
	/* --------------------- END of VietUni --------------------*/

	var vUni = new vietUni();


// Dictionary Version
	var VERSION = 20140810; //(new Date()).getTime();

	/**
	 * This is the code that changes vietUni2 into a Han/Nom-IME
	 */

	var charDetails = {
		//'xin\u5400': 'to ask for, to beg'
	}

	var dictstr = "|-_ideographicHyphen:－|&_ideographicAmpersand:＆|\"_ideographicQuoteEnd:」|\"_ideographicQuoteStart:「|\"_ideographicDoubleQuote:＂|<_ideographicBracket:〈|>_ideographicBracket:〉|<_ideographicBracket:《|>_ideographicBracket:》|[_ideographicBracket:【|]_ideographicBracket:】|(_ideographicBracket:（|)_ideographicBracket:）";
    dictstr += "|__ideographicSpace:　|._ideographicDot:。|,_ideographicList:、|?_ideographicQuestionMark:？|!_ideographicExclamationMark:！|=_unknownCharacterSymbol:〓|;_ideographicSemicolon:；|*_ideographicAsterisk:＊|/_ideographicSlash:／";
	dictstr += "|:_ideographicColon:："; /* hide, because colon is used for pa-strings */
    dictstr += "|__backslash:\\|__iterationMark:ヌ,ㇶ,〻,ゝ,々|__unknownSymbol:〓|__nhayMark:𡿨";
    dictstr += "|\\_plus:+|\\_iterationMark:ヌ,ㇶ,〻,ゝ,々|\\_unknownSymbol:〓|\\_nhayMark:𡿨";
    dictstr += "|\\_idsSymbol:⿰,⿱,⿻,⿴,⿺,⿸,⿹,⿵,⿷,⿶,⿳,⿲";
    dictstr += "|__idsSymbol:⿰,⿱,⿻,⿴,⿺,⿸,⿹,⿵,⿷,⿶,⿳,⿲";
    dictstr += "|%_idsSymbol:⿰,⿱,⿻,⿴,⿺,⿸,⿹,⿵,⿷,⿶,⿳,⿲";
    dictstr += "|idsSymbol:⿰,⿱,⿻,⿴,⿺,⿸,⿹,⿵,⿷,⿶,⿳,⿲";
	dictstr += "|nháy:𡿨,口,亇,厶";
	dictstr += "|nhayMark:𡿨,口,亇,厶";
	dictstr += "|geta:〓";
	dictstr += "|iteration:ヌ,ㇶ,〻,ゝ,々";
	var lcdict = dictstr.toLowerCase();

	var GLYPHS_WITH_IMAGE = "";
	 
	// Make frequency cache persistent
	var localStorage = window.localStorage ? window.localStorage : {};
	var usage = localStorage || {};

	var upperCaseChar_RegExp;
	var vietUCMap = "";
	var map = new Array("UNICODE", 97, 226, 259, 101, 234, 105, 111, 244,
		417, 117, 432, 121, 65, 194, 258, 69, 202, 73, 79, 212, 416, 85, 431, 89,
		225, 7845, 7855, 233, 7871, 237, 243, 7889, 7899, 250, 7913, 253, 193,
		7844, 7854, 201, 7870, 205, 211, 7888, 7898, 218, 7912, 221, 224, 7847,
		7857, 232, 7873, 236, 242, 7891, 7901, 249, 7915, 7923, 192, 7846, 7856,
		200, 7872, 204, 210, 7890, 7900, 217, 7914, 7922, 7841, 7853, 7863, 7865,
		7879, 7883, 7885, 7897, 7907, 7909, 7921, 7925, 7840, 7852, 7862, 7864,
		7878, 7882, 7884, 7896, 7906, 7908, 7920, 7924, 7843, 7849, 7859, 7867,
		7875, 7881, 7887, 7893, 7903, 7911, 7917, 7927, 7842, 7848, 7858, 7866,
		7874, 7880, 7886, 7892, 7902, 7910, 7916, 7926, 227, 7851, 7861, 7869,
		7877, 297, 245, 7895, 7905, 361, 7919, 7929, 195, 7850, 7860, 7868, 7876,
		296, 213, 7894, 7904, 360, 7918, 7928, 100, 273, 68, 272);
	for (var i = 1; i < map.length; i++) vietUCMap += String.fromCharCode(map[i]);

	// Build a regexp with all upper case chars (for finding word boundaries in compounds)
	var upperCaseChars_String = "";
	var map = ["UNICODE", 65, 194, 258, 69, 202, 73, 79, 212, 416, 85, 431, 89, 193, 7844, 7854, 201, 7870, 205, 211, 7888, 7898, 218, 7912, 221, 192, 7846, 7856, 200, 7872, 204, 210, 7890, 7900, 217, 7914, 7922, 7840, 7852, 7862, 7864, 7878, 7882, 7884, 7896, 7906, 7908, 7920, 7924, 7842, 7848, 7858, 7866, 7874, 7880, 7886, 7892, 7902, 7910, 7916, 7926, 195, 7850, 7860, 7868, 7876, 296, 213, 7894, 7904, 360, 7918, 7928, 68, 272];
	for (var i = 1; i < map.length; i++) upperCaseChars_String += String.fromCharCode(map[i]);
	upperCaseChar_RegExp = RegExp("([A-Z" + upperCaseChars_String + "])", "g");

	/*----------------- CLASSES ------------------ */
	URL_LOADED = {};
	dict_compounds("nôm:\u5583");
	ID = 0;

	// Intercept events from vietUni2

	IMEClass.prototype.sendKey = function(evt) {
		if (!this.settings.candidate_list) {
			this.hide();
			return;
		}
		
		if (evt == null) evt = event;
		var c = typeof evt == "number" ? evt
			: typeof evt == "string" ? (evt+" ").charAt(0)
			: document.all ? evt.keyCode : (evt.which || evt.charCode);

		var w = this.vUni.getCurrentWord(this.node, 30, c);
		if (typeof evt == "number") w += String.fromCharCode(c);

		//if (w == null) return;
		var selector;
		var word = "";
		var compound2 = "";
		var compound3 = "";

		if (w.charAt(w.length-1) == '+' && (w.length < 2 || w.charAt(w.length-2) != ' ')) {
			w = w.substr(0,w.length-1);
            this.vUni.replaceWord(this.node, w);
            this.showCandidates(1, true);
            return;
        }
		if (w.charAt(w.length-1) == ' ') {
			w = w.substr(0,w.length-1); 
		}
		if (c == 0) c = w.charCodeAt(w.length - 1);

		// Strip selector number keys and return key. c==0 is when android soft keyboard submits text
        if ((this.settings.return_select && c == 13) || (this.settings.space_select && c == 32) || (w != null && "0123456789".indexOf(w.charAt(w.length-1)) > -1 ) && (c == 0 || String.fromCharCode(c).match(/[0-9]/)) ) {
			selector = w.charAt(w.length-1);
			if (c == 13 || c == 32) selector = 1; else selector = parseInt(selector) || 10;
			if ("0123456789 ".indexOf(w.charAt(w.length-1)) > -1) w = w.substr(0, w.length-1);
		} else if (c == 33 || c == 34) {
			this.showCandidates(c == 33 ? -1 : 1);
			return false;
		} else if (c == 8) { // Back button
			// Delete orphaned surrogate pair remainders
			var code = w.charCodeAt(w.length-1);
			if (code >= 0xD800 && code <= 0xDBFF) {
				this.vUni.replaceWord(this.node, w.substr(0, w.length-1));
			}
		}
		
		// Get only the last word from the buffer
		if (w != null) {
			var i;
			for (i = w.length - 1; i > -1; i--) {
				var ch = w.charAt(i);
				if (vietUCMap.indexOf(ch) >= 0 || ch.match(/[a-zA-Z0-9]/) || (ch == ' ' && i == w.length-1)) {
					word = ch + word;
				} else break;
			};
		}
		word = word.toLowerCase();

		// Get additional compound part
		if (word == "" && w != null && w.charAt(i) != '' && " \\`^°-_.,:;?!/+*#=<>(){}[]'\"&~%|".indexOf(w.charAt(i)) >= 0) {
			word = w.charAt(i);
			i--;
		}

        if (this.settings.compounds) {
            if (word != "" && (w != null && (w.charAt(i) == " " || w.charAt(i) == "-")) && i > 0) {
                i--;
                for (i; i > -1; i--) {
                    var ch = w.charAt(i);
                    if (vietUCMap.indexOf(ch) < 0 && !ch.match(/[a-zA-Z0-9]/)) {
                        break;
                    }
                    if (ch == " ") ch = "-";
                    compound2 = ch + compound2;
                };
                compound2 = compound2.replace(/^\-+/, '').toLowerCase();
            } else if (word != "") {
                var code = w.charCodeAt(i);
                var chr = String.fromCharCode(code);
                i--;
                if (i > 0 && (code >= 0xD800 && code <= 0xDBFF) || (code >= 0xDC00 && code <= 0xDFFF)) {
                    var code = w.charCodeAt(i);
                    if (code > 0) chr = String.fromCharCode(code) + chr;
                }
                compound2 = chr;
            }
            
            // Get additional compound part
            if (compound2 != "" && (w != null && (w.charAt(i) == " " || w.charAt(i) == "-")) && i > 0) {
                i--;
                for (i; i > -1; i--) {
                    var ch = w.charAt(i);
                    if (vietUCMap.indexOf(ch) < 0 && !ch.match(/[a-zA-Z0-9]/)) break;
                    if (ch == " ") ch = "-";
                    compound3 = ch + compound3;
                };
                compound3 = compound3.replace(/^\-+/, '').toLowerCase();
            } else if (compound2 != "") {
                var code = w.charCodeAt(i);
                var chr = String.fromCharCode(code);
                i--;
                if (i > 0 && (code >= 0xD800 && code <= 0xDBFF) || (code >= 0xDC00 && code <= 0xDFFF)) {
                    var code = w.charCodeAt(i);
                    if (code > 0) chr = String.fromCharCode(code) + chr;
                }
                compound3 = chr;
            }
        }
        
		if (!selector) {
			// Build candidate list
			var remainder_required = (word.charAt(word.length-1) == '-' ? true : false);
			word = word.replace(/[\-']/g, '');
			this.buildCandidates(word, remainder_required, false);
            var comps = [word];
			if (word != "" && compound2 != "" && compound2 != "\0") {
				compound_word = (compound2+word).replace(/[\-']/g, '');
				this.buildCandidates(compound_word, remainder_required, true);
			}
			if (word != "" && compound3 != "" && compound3 != "\0") {
				var compound_word = (compound3+compound2+word).replace(/[\-']/g, '');
				this.buildCandidates(compound_word, remainder_required, true);
			}
            if (word != "" && this.vUni.candidateList && this.settings.process_list) {
                var list = this.vUni.candidateList.items;
                this.settings.process_list(word, list, function(value, label, idx){
                    if (idx > list.length) idx = list.length;
                    else if (idx < 0) idx = list.length + idx + 1;
                    this.splice(idx||0, 0, [value, label, '', 0, 0, 0]);
                }.bind(list));
                this.vUni.candidateList.items = list;
                this.vUni.candidateList.pages = parseInt((list.length + 9) / 10);
            }

			this.showCandidates(0);
		} else if (this.vUni.candidateList) {
			// Insert selected character
            var idx = (10 * this.vUni.candidateList.page) + selector - 1;
            if (idx >= this.vUni.candidateList.items.length) idx = this.vUni.candidateList.items.length - 1;
			var item = this.vUni.candidateList.items[idx];
			if (item) {
				var glyph = item[0];
				if (glyph == "\n") {
					this.vUni.replaceWord(this.node, this.selectEntry(glyph, w+"\n"));
				} else {
					var compare = (item[1] + item[2]).toLowerCase()
					if (compound3 != "" && glyph.length >= 3 && compare.indexOf(compound3 + compound2 + word) == 0) {
						word = compound3 + " " + compound2 + " " + word;
					} else if (compound2 != "" && glyph.length >= 2 && compare.indexOf(compound2 + word) == 0) {
						if (compound2.charCodeAt(0) > 0x2000)
							word = compound2 + word;
						else
							word = compound2 + " " + word;
					}
					var hyph = w.substr(0, 1) == '-' ? '-' : '';
                    
					var replacement = w.substr(0, w.length - word.length) + hyph + this.selectEntry(glyph, word);
					this.vUni.replaceWord(this.node, replacement);
					
					this.hide();
					usage[glyph] = (parseInt(usage[glyph])||0) + 1;
					
					//if (window.trackEvent != null) trackEvent('IME', 'Insert', glyph + ' ' + word, null, null, false);
				}
			}
		} else {
            console.log("No candidate selected")
            this.selectEntry(null, word);
        }
	};

	function loadDictionaries(ime) {
		var loader = function(instance, finish) {
			if (instance.__loading_started__) {
                return;
            }
			instance.__loading_started__ = true;
			var dicts = instance.settings.dictionaries;
			if (typeof dicts == "object" && Object.prototype.toString.call(dicts) == "[object Object]") dicts = [ dicts ];
			//else if (typeof dicts == "string") dicts = [ dicts ];
			var use_cache = false;
			if (instance.settings.cached_dictionary) {
				dicts.push(instance.settings.cached_dictionary);
				use_cache = true
			}
            instance._loadStack = 0;
            instance._finishFn = finish;
			for (var i = 0, ilen = dicts.length; i < ilen; i++) {
				var url_data = dicts[i];
				if (typeof url_data == "string") {
					if (use_cache && i == ilen-1 && localStorage['__dictionary_cache_'+CACHEVERSION+'__'+instance.settings.cached_dictionary] != null) {
						console.log("Loading dictionary from cache");
						var data = $.parseJSON(localStorage['__dictionary_cache_'+CACHEVERSION+'__'+instance.settings.cached_dictionary]);
						if (data && data.dict) dict_compounds(data.dict);
						if (data && data.defs) $.extend(charDetails, data.defs);
					} else if (!URL_LOADED[url_data]) {
						URL_LOADED[url_data] = 1;
						if (use_cache && i == ilen-1) {
							console.log("Loading dictionary to cache: " + url_data);
                            instance._loadStack++;
							$.ajax({ url: url_data, success: function(data) {
                                if (--this._loadStack == 0 && this._finishFn) {this._finishFn(), this._finishFn = null}
								localStorage['__dictionary_cache_'+CACHEVERSION+'__'+this.settings.cached_dictionary] = data;
								data = $.parseJSON(data);
								if (data && data.dict) dict_compounds(data.dict);
								if (data && data.defs) $.extend(charDetails, data.defs);
							}.bind(instance)});
						} else {
							console.log("Loading dictionary " + url_data);
                            instance._loadStack++;
							$.ajax({ url: url_data, success: function(data) {
                                if (--this._loadStack == 0 && this._finishFn) {this._finishFn(), this._finishFn = null}
								data = $.parseJSON(data);
								if (data && data.dict) dict_compounds(data.dict);
								if (data && data.defs) $.extend(charDetails, data.defs);
							}.bind(instance)});
						}
					}
				} else {
					console.log("Loading dictionary object", url_data);
					var data = url_data;
					if (data && data.dict) dict_compounds(data.dict);
					if (data && data.defs) $.extend(charDetails, data.defs);
				}
			}
            if (instance._loadStack == 0 && instance._finishFn) {
                instance._finishFn(), instance._finishFn = null;
            }
		};
		if (ime.settings.defer) {
            console.log("Set trigger...");
            var deferred = function(){
                if (!this.__loading_started__){
                    var info = $('<div class="ime-starting-indicator">⌛</div>').css({position:'absolute',background:'black',color:'black',lineHeight:'1.5em',width:'1.5em',textAlign:'center',opacity:.6,borderRadius:'100px',fontFamily:'serif'});
                    var pos = $(this.node).attr('readonly', true).before(info).position();
                    info.css({top: pos.top, left: pos.left, transition: '1.25s transform', transform: 'rotate(360deg)'})
                    console.log("Loading...");
                    loader(this, function(info){
                        console.log("Done...");
                        $(this.node).attr('readonly', false);
                        $('.ime-starting-indicator').hide();
                    }.bind(this, info));
                }
            }.bind(ime);
			$(ime.node).bind("keydown.ime-loader", deferred).bind("focus.ime-loader", deferred);
		} else {
			loader(ime);
		}
	}

	IMEClass.prototype.initialize = function(isFirstInit) {
		var s = this.settings, $node = $(this.node);

		addStyle.apply(this, [isFirstInit]);
		
		if (!isFirstInit) {
			$node.unbind(".ime");
		}
		
		if (isFirstInit && s.candidate_list && (s.dictionaries || s.cached_dictionaries)) {
			loadDictionaries(this);
		}
		
		// All special chars from vietUni2code
		var vUni = this.vUni;
		if (isFirstInit) vUni.initTyper(this.node);
		if (s.method === true) {
			vUni.setMethod(s.candidate_list ? 1 : 4);
        } else if (s.method == "telex") {
			vUni.setMethod(1);
		} else if (!s.method || s.method == "off") {
			vUni.setMethod(0);
		} else if (s.candidate_list && s.method) {
			vUni.setMethod(1);
		} else if (s.method == "vni") {
			vUni.setMethod(2);
		} else {
			vUni.setMethod(s.method);
		}
		
		$node.attr('autocomplete', 'off')
			//.attr('autocorrect', 'off')
			//.attr('autocapitalize', 'off')
			//.attr('spellcheck', 'off')
			;

		$node.bind("blur.ime", function(evt){
			$(this).data("ime").hide();
		});
		
		$node.bind("keyup.ime", function(evt) {
			var ime = $(evt.target).data("ime");
            if (!ime) return;
			var c = document.all ? evt.keyCode : (evt.which || evt.charCode);
            if ((evt.shiftKey || evt.ctrlKey) && (c == 32 || c == 13)) return true;
			// Escape
			if (c == 27) {
				ime.hide();
				return false;
			}
			return ime.sendKey(evt);
		});
		 
		$node.bind("mouseup.ime", function(evt){ $(this).trigger('keyup') });
		
		$node.bind("keydown.ime", function(evt){
			var ime = $(evt.target).data("ime");
            if (!ime) return;
			var c = document.all ? evt.keyCode : (evt.which || evt.charCode);
            if ((evt.shiftKey || evt.ctrlKey) && (c == 32 || c == 13)) return true;
			// Cancel PgUp/PgDown keys
			if (c == 33 || c == 34) return false;
			var list = vUni.candidateList;
			// Cancel Return key if candidate list is filled and key is enabled for selecting
			if (list && list.items && list.items.length > 0) {
				if (c == 13 && ime.settings.return_select) { return false }
				if (c == 32 && ime.settings.space_select) { return false }
			}
		});
	};

	// Adds entries to dictionary
	function dict(str, has_compounds) {
		if (str == null || str == "") return;
		if (str.substr(0,1) != "|") str = "|" + str;
		if (has_compounds) {
			// TODO: generate mixed char+letter entries
			parts = str.substr(1).split('|');
			var str2 = "";
			for (var p in parts) {
				var m = parts[p].split(':');
				if (!m[1]) continue;
				if (m[1].length > 1) {
					var pos = m[0].search(upperCaseChar_RegExp);
					var word = m[1].charAt(0);
					var code = m[1].charCodeAt(0);
					if ((code >= 0xD800 && code <= 0xDBFF) || (code >= 0xDC00 && code <= 0xDFFF)) {
						word += m[1].charAt(1)
					}
					var w = word + m[0].substr(pos) + ':' + m[1];
					str2 += '|' + w;
				}
				if (m[1].length > 2) {
					var pos = m[0].search(upperCaseChar_RegExp);
					var word = m[1].charAt(0);
					var code = m[1].charCodeAt(0);
					if ((code >= 0xD800 && code <= 0xDBFF) || (code >= 0xDC00 && code <= 0xDFFF)) {
						word += m[1].charAt(1)
					}
					var pos2 = m[0].search(upperCaseChar_RegExp, pos+1);
					var word2 = m[1].charAt(1);
					var code2 = m[1].charCodeAt(1);
					if ((code2 >= 0xD800 && code2 <= 0xDBFF) || (code2 >= 0xDC00 && code2 <= 0xDFFF)) {
						word2 += m[1].charAt(2)
					}
					var w2 = word + word2 + m[0].substr(pos2) + ':' + m[1];
					str2 += '|' + w2;
				}
			}
			str += str2; //"|\u5400Ch\u00E0o:\u5400\u5632";
		}
		dictstr += str;
		lcdict += str.toLowerCase();
	}

	function dict_compounds(str) {
		dict(str, true);
	}

	IMEClass.prototype.buildCandidates = function(w, remainder_required, append) {
		var vUni = this.vUni;
		if (w == "") {
			if (!this.settings.show_defaults) {
				this.hide();
				return;
			}
			return vUni.candidateList = {
				items: [
					//[ str, head, remainder, collate, use_count, remainder.length ]
					[ "\n", '', '', 0, 0, 0 ],
					[ '　', '', '', 0, 0, 0 ],
					[ '。', '', '', 0, 0, 0 ],
					[ '、', '', '', 0, 0, 0 ],
					[ '，', '', '', 0, 0, 0 ],
					[ '！', '', '', 0, 0, 0 ],
					[ '？', '', '', 0, 0, 0 ],
					[ '＂', '', '', 0, 0, 0 ],
					[ 'ヌ', '', '', 0, 0, 0 ],
					[ '〓', '', '', 0, 0, 0 ],

					[ '：', '', '', 0, 0, 0 ],
					[ '；', '', '', 0, 0, 0 ],
					[ '－', '', '', 0, 0, 0 ],
					[ '＊', '', '', 0, 0, 0 ],
					[ '・', '', '', 0, 0, 0 ],
					[ '＆', '', '', 0, 0, 0 ],
					[ '＋', '', '', 0, 0, 0 ],
					[ '／', '', '', 0, 0, 0 ],
					[ '‹', '', '', 0, 0, 0 ],
					[ '々', '', '', 0, 0, 0 ],

					[ '「', '', '', 0, 0, 0 ],
					[ '」', '', '', 0, 0, 0 ],
					[ '【', '', '', 0, 0, 0 ],
					[ '】', '', '', 0, 0, 0 ],
					[ '〈', '', '', 0, 0, 0 ],
					[ '〉', '', '', 0, 0, 0 ],
					[ '《', '', '', 0, 0, 0 ],
					[ '》', '', '', 0, 0, 0 ],
					[ '（', '', '', 0, 0, 0 ],
					[ '）', '', '', 0, 0, 0 ],
					
					[ '１', '', '', 0, 0, 0 ],
					[ '２', '', '', 0, 0, 0 ],
					[ '３', '', '', 0, 0, 0 ],
					[ '４', '', '', 0, 0, 0 ],
					[ '５', '', '', 0, 0, 0 ],
					[ '６', '', '', 0, 0, 0 ],
					[ '７', '', '', 0, 0, 0 ],
					[ '８', '', '', 0, 0, 0 ],
					[ '９', '', '', 0, 0, 0 ],
					[ '０', '', '', 0, 0, 0 ],
					
					[ '①', '', '', 0, 0, 0 ],
					[ '②', '', '', 0, 0, 0 ],
					[ '③', '', '', 0, 0, 0 ],
					[ '④', '', '', 0, 0, 0 ],
					[ '⑤', '', '', 0, 0, 0 ],
					[ '⑥', '', '', 0, 0, 0 ],
					[ '⑦', '', '', 0, 0, 0 ],
					[ '⑧', '', '', 0, 0, 0 ],
					[ '⑨', '', '', 0, 0, 0 ],
					[ '⑩', '', '', 0, 0, 0 ],
					
					[ '⑪', '', '', 0, 0, 0 ],
					[ '⑫', '', '', 0, 0, 0 ],
					[ '⑬', '', '', 0, 0, 0 ],
					[ '⑭', '', '', 0, 0, 0 ],
					[ '⑮', '', '', 0, 0, 0 ],
					[ '⑯', '', '', 0, 0, 0 ],
					[ '⑰', '', '', 0, 0, 0 ],
					[ '⑱', '', '', 0, 0, 0 ],
					[ '⑲', '', '', 0, 0, 0 ],
					[ '⑳', '', '', 0, 0, 0 ],
					
					[ '⿰', '', '', 0, 0, 0 ],
					[ '⿱', '', '', 0, 0, 0 ],
					[ '⿲', '', '', 0, 0, 0 ],
					[ '⿳', '', '', 0, 0, 0 ],
					[ '⿴', '', '', 0, 0, 0 ],
					[ '⿵', '', '', 0, 0, 0 ],
					[ '⿶', '', '', 0, 0, 0 ],
					[ '⿷', '', '', 0, 0, 0 ],
					[ '⿸', '', '', 0, 0, 0 ],
					[ '⿹', '', '', 0, 0, 0 ],
					
					[ '⿺', '', '', 0, 0, 0 ],
					[ '⿻', '', '', 0, 0, 0 ]
					
				], pages: 8, page: 0
			};
		}
		var list = [];
		var seen = {};
		var i = 0;
		while ((i = lcdict.indexOf("|" + w + (w.length > 0 ? '' : ':'), i) + 1) && i > -1 ) {
			var head = dictstr.substr(i, w.length);
			var chunk = dictstr.substr(i + w.length, 100) + "|##";
			var m = chunk.replace(/\|.*?##/g, "").replace(/[\r\n]/g, "").split(":", 2);
			var remainder = m[0];
			if (remainder_required){
				if (remainder == "" || !remainder.match(upperCaseChar_RegExp)) continue;
			}
			var matches = m[1] != null ? m[1].split(",") : [];
			//console.log(w,m,matches);
			var tmp = 0;
			for (var k = 0, mmlen = matches.length; k < mmlen; k++) {
				var match = matches[k];
				var str = "";
				for (var j = 0, mlen = match.length; j < mlen; j++) {
					var code = match.charCodeAt(j);
					if (code > 0xD800 && code < 0xDBFF) { tmp = code; continue }
					// var surrogate_code = tmp ? 0x10000 + ((tmp - 0xD800) * 0x400) + (code - 0xDC00) : code
					str += (tmp?String.fromCharCode(tmp):'') + String.fromCharCode(code);
					tmp = 0;
				}
				if (seen[str]) continue;
				var collate = 0;
				// create a number for sorting accented letters
				for (var m = 0; m < remainder.length; m++) {
					collate = (collate * 10000) + (remainder.charCodeAt(m) % 10000)
				}
				var use_count = parseInt(usage[str]||0);
				var has_def = charDetails[head + remainder + str];
				if (has_def) use_count = (use_count+1) * 2;
				list.push([ str, head, remainder, collate, use_count, remainder.length ]);
				seen[str] = 1;
				if (list.length == 100) break;
			}
			if (list.length == 100) break;
		}
		list.sort(function(a,b) {
			return(
				a[5] < b[5] ? -1		// Short remainders first
				: a[5] > b[5] ? 1		// Short remainders first
				: (						// SAME LENGTH REMAINDERS:
					(b[4] - a[4])		// Order By Usage
					|| (a[3] - b[3])	// Alphabetical
				)
			);
		});
		var clist = vUni.candidateList;
		if (append && clist && clist.items) {
			list = list.concat(clist.items);
		}
		var numPages = parseInt((list.length + 9) / 10);
		vUni.candidateList = {items: list, pages: numPages, page: 0};
		return true;
	};
	
	IMEClass.prototype.showCandidates = function(move, revolve) {
		var clist = $("<div></div>");
		var cand = this.vUni.candidateList;
		if (!cand) return;
		
		if (!cand.items) return;
		var items = cand.items;
		cand.page = (move ? cand.page + move : 0);
		if (cand.page >= cand.pages) cand.page = revolve ? 0 : cand.pages - 1;
		if (cand.page < 0) cand.page = 0;
		var page = cand.page;
	 
		var max = 10 * page + 10;
		if (max > items.length) max = items.length;
        
		var instance = this, number = 0;
		for (var i = 10 * page; i < max; i++) {
			if (!items[i]) break;
			number++;
			var head = items[i][1];
			var remainder = items[i][2];
			// If entry has a _ then hide the part before the underscore
			is_punctuation = false;
			if (remainder.charAt(0) == "_") {
				is_punctuation = true;
				head = remainder.substr(1);
				remainder = '';
			}
			head = head.replace(upperCaseChar_RegExp, "<tt class='ime-text-hyphen'>-</tt>$1").toLowerCase();
			remainder = remainder.replace(upperCaseChar_RegExp, "<tt class='ime-text-hyphen'>-</tt>$1").toLowerCase();
			var definition = '';
			if (this.settings.show_definitions) {
				definition = charDetails[items[i][1]+items[i][2]+items[i][0]];
				definition = definition == null ? '' : "<a class='ime-definition' title=\"" + definition.replace('"',"''") + "\" target='_blank'><em class='ime-definition-arrow'>&#x2192;</em> <span>" + definition + "</span></a>";
			}
			var num = ((i+1)%10) + ".";
			if (is_punctuation && max == 1 && this.settings.return_select) num = '&nbsp;';
			//if (this.settings.return_select && num == "1.") num = '<em class="ime-number" style="font-weight:bold">&#x21a9;</em>'; //&#x21a9; or &crarr;
			else num = '<em class="ime-number">' + num + '</em>'
			var glyph = items[i][0];
	//		if (GLYPHS_WITH_IMAGE.indexOf(glyph) > -1) glyph = '<img src="/media/generated/' + glyph.charCodeAt(0).toString(16) + '-32.png" title="' + glyph + '" alt="' + glyph + '" width="24" height="24">';
			var itm = $("<div class='ime-candidate ime-candidate-"+number+"'>" + definition + num + " <span class='ime-glyph'>" + glyph + "</span><span class='ime-text'><i class='ime-text-head'>" + head + "</i><b class='ime-text-remainder'>" + remainder + "</b></span></div>");
			itm.bind('touchend click', function(evt) {
				var n = $(evt.target).closest('.ime-candidate').attr('class').split("-").pop();
				instance.sendKey(n.charCodeAt(n.length-1));
				$(instance.node).focus();
				evt.stopPropagation();
				return false;
			}).bind('touchend mousedown',
				// Prevents the soft keyboard on windows touch to pop up
				function(){}, false
			);
			clist.append(itm);
		}
		var container = $("<div class='ime-candidate-list'></div>")
			.attr('id', 'ime-id-'+this.id)
			.append(clist)
			;
		this.updateCandidates(container, items.length, cand.page+1, cand.pages, items);
	};


	IMEClass.prototype.show = function() {
		$(this.node).trigger('keyup');
	}
	
	IMEClass.prototype.hide = function() {
		this.vUni.candidateList = {items: [], pages: 0, page: 0};
		$("#ime-id-"+this.id).hide();
		if (this.settings.list_changed) this.settings.list_changed(null,0,0,0);
	};

	function addStyle(isFirstInit) {
		if ($("#ime-styles-"+this.id).length > 0) $("#ime-styles-"+this.id).remove();
		var defaults = [
			"sans-serif",
			"han-nom gothic",
			"han-nom gothic supplement",
			"Heiti TC",
			"Heiti SC",
			"nom na tong",
			"nom na tong supplement",
			"hanaminb",
			"hanamina",
			"MingLiU-ExtB",
			"PMingLiU-ExtB",
			"SimSun-ExtB"
		]
		var list = this.settings.font_list;
		if (!list || typeof list == "string") list = list ? list.split(/\s*,\s*/) : [];
		var fonts = list.concat(defaults).join(",").replace(/ /g, '\\000020');
		var s = this.settings;
		var prefix = "#ime-id-"+this.id;
        $("#ime-styles-"+this.id).remove();
        $("<style id='ime-styles-"+this.id+"'>").prependTo();
		$("html").prepend($("<style id='ime-styles-"+this.id+"'>"
			+ ".ime-candidate-list-container { z-index: 999999999999; position: absolute; min-width: 14em; width: auto }"
			+ prefix+".ime-candidate-list { background: " + s.background + "; color: " + s.text_color + "; border: " + s.border + "; width: 100%; max-width: 28em; font-family: sans-serif }"
			+ prefix+" .ime-number,"+prefix+" .ime-glyph,"+prefix+" .ime-definition,.ime-text { line-height: 30px }"
			+ prefix+" .ime-candidate:first-child { border-top: none }"
			+ prefix+" .ime-candidate { cursor: pointer; padding: "+parseInt(s.padding)+"px 0; padding-left: 10px; border-top: 1px solid " + s.grid_color + "; white-space: nowrap; overflow: hidden }"
			+ prefix+" .ime-candidate:hover { background-color: rgba(10, 120, 255, .4); transition: background-color 0.3s }"
			+ prefix+" .ime-number { float: left; display: inline-block; font-style: normal; margin-left: 0.25em; margin-right: .5em }"
			+ prefix+" .ime-definition { font-size: 0.7em; float: right; display: inline-block; margin-left: 1em; width: 8em; overflow: hidden; white-space: nowrap; opacity: 0.8; color: " + s.text_color + "; text-decoration: none; text-align: left }"
			//+ ".ime-definition:hover { overflow: visible; width: auto; display: absolute; text-align: right; margin: 0 0.3em; opacity: 1 }"
			+ prefix+" .ime-definition:hover em { display: none }"
			+ prefix+" .ime-definition:hover span { background-color: white; padding: 0.42em; padding-right: 0; border-radius: 0.2em; border: 1px solid gray; transition: background-color 1.8s }"
			+ prefix+" .ime-definition-arrow { width: 20px; font-weight: bold }"
			+ prefix+" .ime-glyph { float: left; color: " + (s.glyph_color||s.text_color) +"; display: inline-block; font-size:1.5em; padding: 0 0.1em; font-family: " + fonts + "}"
			+ prefix+" .ime-candidate:hover .ime-glyph { background-color: white; border-radius: 0.2em }"
			+ prefix+" .ime-text { display: inline-block; float: left; margin-left: 1em; font-family: sans-serif }"
			+ prefix+" .ime-text-head { color: " + s.text_color + " }"
			+ prefix+" .ime-text-remainder { color: " + s.autocomplete_color + " }"
			+ prefix+" .ime-text-hyphen { color: " + s.text_color + "; opacity: 0.5 }"
        + "</style>"));
		if (this.settings.match_fonts && this.settings.candidate_list) {
			$(this.node).css({ fontFamily: fonts });
		} else if(!isFirstInit) {
			$(this.node).css({ fontFamily: '' });
		}
	}

	function default_list_change(container, items, page, pages, glyphs) {
		var div = $(".ime-candidate-list-container");
		if (div.length == 0) {
			div = $("<div class='ime-candidate-list-container'></div>")
			$("body").append(div);
		}
		div.hide().html("").append(container);
		var node = $(this.node);
		var pos = node.offset();
		var left = parseInt(pos ? pos.left : 0);
		var top = parseInt(pos ? pos.top : 0);
		var offX = this.settings.offsetX, offY = this.settings.offsetY;
		var p = this.settings.position;
		if (p == "float") {
            console.log(p)
			try {
				var pos2 = node.getCaretPosition('x');
				//top += pos2.bottom + offY;
				top += -node.height() + pos2.top + offY;
				left += pos2.left + offX;
				if (left+div.outerWidth() > $(window).innerWidth()-5) left = $(window).outerWidth()-div.outerWidth()-5;
				if (left < 0) left = 0;
                console.log('top', top)
			} catch(e) {
				left += node.outerWidth() - div.outerWidth();
				if (left < 0) left = 0;
			}
		}
		if (p == "bottom") {
			top += node.outerHeight() + offY;
			left += offX;
		} else if (p == "right") {
			top += offY;
			left += node.outerWidth()
		} else if (p == "left") {
			top += offY;
			left -= div.outerWidth()
		} else if (p == "left") {
			top += offY;
			left -= div.outerWidth()
		} else if (p == "top") {
			top -= div.outerHeight()
			left += offX;
		} else {
            /* Default bottom */
			top += node.outerHeight() + offY;
			left += offX;
        }
		div.css({ "top": top, "left": left });
		if (div.text() == "") div.hide();
		else div.show();
	}

	function IMEClass(node, options) {
		this.id = ID++;
        var schema = location.href.indexOf('file://') == 0 ? 'http://' : '//';
		this.settings = $.extend({
			defer: false,
			return_select: false,
			space_select: false,
			cached_dictionary: schema+'www.chunom.org/entry/base_chars/', /* Dictionary to load once and saved permanently in browser cache */
			dictionaries: [schema+'www.chunom.org/entry/generated_chars/'], /* Dictionaries to load */
			show_defaults: false, /* Show list of default symbols if no matches candidates */
			show_definitions: true,
			list_changed: null, /* Handler for candidate list change event */
			candidate_selected: null, /* call back (glyph, word) must return glyph */
			font_list: '', /* CSS font stack to use for character display */
			match_fonts: true, /* Applies font list to input field, too. Only when chunom=true */
			background: '#eeeeee',
			glyph_color: null, /* defaults to text_color */
			text_color: '#000000',
			autocomplete_color: '#0000ff',
			border: '2px solid #000000',
			grid_color: '#333333',
			padding: 2,
			position: 'bottom',
			offsetX: 0,
			offsetY: 0,
			method: true, /* Typing method, false/0=plain text, true/1=telex, 2=VNI, 3=viqr, 4=all, 5=compound telex */
			candidate_list: false /* Enable Chu Nom typing */
		}, options);
		this.node = node;
		this.vUni = new vietUni(); // comment out to use seperate typers per instance
		this.selectEntry = function(glyph, word) {
            if (this.settings.candidate_selected) return this.settings.candidate_selected.apply(this, [glyph, word]);
            else return glyph;
        };
		this.updateCandidates = function(container, items, page, pages, glyphs) {
			default_list_change.apply(this, [container, items, page, pages, glyphs]);
			if (this.settings.list_changed) this.settings.list_changed.apply(this, [container, items, page, pages, glyphs])
		};
		this.initialize(true);
	}

	$.fn.vietime = function(opts, value) {
		if (typeof opts == "string") {
			if (opts == "instance") {
				var ime = [];
				for (var i=0,ilen=this.length; i < ilen; i++) {
					ime.push($(this[i]).data("ime"));
				}
				return ime;
			}
			if (opts == "update") {
				return this.each(function() {
					var ime = $(this).data("ime");
					$.extend(ime.settings, value);
					ime.initialize(false);
					return this;
				})
			}
			return this.each(function() {
				var ime = $(this).data("ime");
				ime.settings[opts] = value
				ime.initialize(false);
				ime.show();
				return this;
			})
		}
		return this.each(function() {
			var ime = $(this).data("ime");
			if (!ime) {
				ime = new IMEClass(this, opts);
				$(this).data("ime", ime);
			}
			return this;
		});
	};

	$.fn.vietime.dict = dict;
	$.fn.vietime.dict_compounds = dict_compounds;

})(jQuery);




/**
 * jQuery plugin for getting position of cursor in textarea

 * @license under Apache license
 * @author Bevis Zhao (i@bevis.me, http://bevis.me)
 */

(function($, window, document, undefined) {
	$(function() {
		var calculator = {
			// key styles
			primaryStyles: ['fontFamily', 'fontSize', 'fontWeight', 'fontVariant', 'fontStyle', 'textDecoration',
				'paddingLeft', 'paddingTop', 'paddingBottom', 'paddingRight', 'textAlign',
				'marginLeft', 'marginTop', 'marginBottom', 'marginRight',
				'borderLeftColor', 'borderTopColor', 'borderBottomColor', 'borderRightColor',
				'borderLeftStyle', 'borderTopStyle', 'borderBottomStyle', 'borderRightStyle',
				'borderLeftWidth', 'borderTopWidth', 'borderBottomWidth', 'borderRightWidth',
				'line-height', 'outline', 'borderRadius', "white-space"],

			specificStyle: {
				'word-wrap': 'break-word',
				'overflow-x': 'hidden',
				'overflow-y': 'auto'
			},

			simulator : $('<div id="textarea_simulator" contenteditable="true"/>').css({
				position: 'absolute',
				top: 0,
				left: 0,
				visibility: 'hidden'
			}).appendTo(document.body),

			toHtml : function(text) {
				return text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g, '<br>')
					.replace(/(\s)/g,'<span style="white-space:pre-wrap;display:inline-block">$1</span>');
			},
			// calculate position
			getCaretPosition: function(word) {
				var cal = calculator, self = this, element = self[0], elementOffset = self.offset();
				
				if (element.tagName == "INPUT") $(element).css('white-space', 'nowrap');

				// IE has easy way to get caret offset position
				if (navigator.appName == "Microsoft Internet Explorer") {
					// must get focus first
					element.focus();
					var range = document.selection.createRange();
					return {
						left: range.boundingLeft - elementOffset.left,
						top: parseInt(range.boundingTop) - elementOffset.top + element.scrollTop
							+ document.documentElement.scrollTop + parseInt(self.getComputedStyle("fontSize"))
					};
				}
				cal.simulator.empty();
				// clone primary styles to imitate textarea
				$.each(cal.primaryStyles, function(index, styleName) {
					self.cloneStyle(cal.simulator, styleName);
				});

				// caculate width and height
				cal.simulator.css($.extend({
					'width': self.width(),
					'height': self.height()
				}, cal.specificStyle));

				var value = self.val(), cursorPosition = self.getCursorPosition();
				var beforeText = value.substring(0, cursorPosition),
					afterText = value.substring(cursorPosition);

				var before = $('<span class="before"/>').html(cal.toHtml(beforeText)),
					focus = $('<span class="focus" style="display:inline-block"/>'),
					after = $('<span class="after" style="display:inline-block"/>').html(word == '' || word == null ? ' i' : ' '+word);

				cal.simulator.append(before).append(focus).append(after);
				var focusOffset = focus.offset(), simulatorOffset = cal.simulator.offset();
				// alert(focusOffset.left  + ',' +  simulatorOffset.left + ',' + element.scrollLeft);
				var top = focusOffset.top - simulatorOffset.top - element.scrollTop
						// calculate and add the font height except Firefox
						+ (/[mM]ozilla/.test(navigator.userAgent) ? 0 : parseInt(self.getComputedStyle("fontSize"))),
					left= focus[0].offsetLeft -  cal.simulator[0].offsetLeft - element.scrollLeft
					;
				return {
					top: top,
					bottom: top + after.height(),
					left: left - after.width(),
					right: left
				};
			}
		};

		$.fn.extend({
			getComputedStyle: function(styleName) {
				if (this.length == 0) return;
				var thiz = this[0];
				var result = this.css(styleName);
				result = result || (navigator.appName == "Microsoft Internet Explorer" ?
					thiz.currentStyle[styleName]:
					document.defaultView.getComputedStyle(thiz, null)[styleName]);
				return result;
			},
			// easy clone method
			cloneStyle: function(target, styleName) {
				var styleVal = this.getComputedStyle(styleName);
				if (!!styleVal) {
					$(target).css(styleName, styleVal);
				}
			},
			cloneAllStyle: function(target, style) {
				var thiz = this[0];
				for (var styleName in thiz.style) {
					var val = thiz.style[styleName];
					typeof val == 'string' || typeof val == 'number'
						? this.cloneStyle(target, styleName)
						: NaN;
				}
			},
			getCursorPosition : function() {
				var thiz = this[0], result = 0;
				if ('selectionStart' in thiz) {
					result = thiz.selectionStart;
				} else if('selection' in document) {
					var range = document.selection.createRange();
					if (document.selection != null && range && range.moveStart && typeof range.moveStart == "function") {
						thiz.focus();
						var length = document.selection.createRange().text.length;
						range.moveStart('character', - thiz.value.length);
						result = range.text.length - length;
					} else {
						var bodyRange = document.body.createTextRange();
						bodyRange.moveToElementText(thiz);
						for (; bodyRange.compareEndPoints("StartToStart", range) < 0; result++)
							bodyRange.moveStart('character', 1);
						for (var i = 0; i <= result; i ++){
							if (thiz.value.charAt(i) == '\n')
								result++;
						}
						var enterCount = thiz.value.split('\n').length - 1;
						result -= enterCount;
						return result;
					}
				}
				return result;
			},
			getCaretPosition: calculator.getCaretPosition
		});
	});
})(jQuery, window, document);

// Splits a string into array of characters
function splitChars(text) {
    var chars = [], tmp = '';
    for (var i=0, tlen=text.length; i<tlen; i++) {
            var c = text[i]; code = c.charCodeAt(0);
            if (code >= 0xD800 && code <= 0xDBFF) {tmp = c; continue}
            chars.push(tmp+c);
            tmp = '';
    }
    return chars
}
