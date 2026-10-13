/**
 * Cover of a deck: the uploaded image, or (without one) a colored square with the first letter of the title.
 * The color comes from the deck id, so a deck always keeps its color. Size and shape are set by the page via `className`.
 */
window.DeckCover = {
  element(deck, url, className) {
    if (url) {
      const img = document.createElement('img');
      img.className = className;
      img.alt = '';
      img.src = url;
      return img;
    }
    let hash = 0;
    for (const ch of String(deck.id || deck.title || '')) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
    const hue = hash % 360;
    const box = document.createElement('div');
    box.className = `${className} deck-cover-ph`;
    box.style.background = `linear-gradient(135deg, hsl(${hue} 45% 46%), hsl(${(hue + 40) % 360} 50% 32%))`;
    const letter = document.createElement('span');
    letter.textContent = (Array.from(String(deck.title || '').trim())[0] || '?').toUpperCase();
    box.append(letter);
    return box;
  },

  // shared by the pages: the letter scales with the size of the box
  css: `div.deck-cover-ph { display: flex; align-items: center; justify-content: center; container-type: size; color: rgba(255,255,255,.92); font-family: Georgia, "Times New Roman", serif; user-select: none; }
div.deck-cover-ph span { font-size: 55cqmin; line-height: 1; }`
};
document.head.append(Object.assign(document.createElement('style'), { textContent: DeckCover.css }));
