// The practice: lessons of the script (qatt.org/practice) and the words of a deck (decks/practice.html) as questions with four answers,
// with energy, progress, score and leaderboard.
// Needs the scripts qatt/js/navigation.js, qatt.js, parser.js, supabase.js and the style css/practice.css.
//
// Options of App.init(container, options):
//   forms: the forms in which words are asked and answered, a list of "nom" (Nôm characters), "qatt" (glyphs) and "text" (quốc ngữ).
//          The practice of chunom uses ["nom", "text"], the practice of qatt ["qatt", "text"]. Without it the lessons of the script
//          ask glyph and text, decks all three forms.
//   requireLogin: true  only signed-in users practice; the others get a page with the sign-in dialog and init() gives null.
class App {
  constructor(container, db, options = {}) {
    this.forms = options.forms || null;
    this.opts = { 
      requiredCorrect: 4,
      maxErrors: 3,
      learningWindow: 4,
      hintDelay: 10000,
    };
    this.db = db;
    this.useDB = true;
    this.username = localStorage.username || "Anonymous";
    this.lessons = {};
    this.currentLesson = null;
    this.globalStyle = localStorage.getItem('qattType') || "-1";
    this.maxEnergy = 5; 
    this.currentEnergy = 5;
    this.parser = new VietnameseParser();
    if (!window.qattObserved) { window.qattObserved = true; new Qatt().observe('qatt-code'); } // draws the <qatt-code> elements, once per page
    this.stats = JSON.parse(localStorage.getItem('qatt_stats')) || { _score: 0 };
    this.hintInterval = null;
    this.activePracticeWord = null;
    this.lastPracticeWord = null; 
    this.categories = [];
    this.items = {};      // words of decks: key -> { n: Nôm, qn: quốc ngữ }, see addLesson()
    this.backUrl = null;  // set for a single deck: where the way back leads, instead of the list of lessons
    
    container.innerHTML = `
<header class="fixed-header-container">
    <div class="container d-flex align-items-center w-100">
      <div id="library-btn" class="nav-icon-btn" title="Trang chủ">🏠</div>

      <div class="status-group">
        <div id="badge-total" class="score-badge badge-total" title="Tổng điểm">🏆 <span id="val-total">0</span></div>
        <div id="badge-sunflower" class="score-badge badge-sunflower" title="Hoa">🌻 <span id="val-sunflower">0</span></div>
        <div id="badge-coin" class="score-badge badge-coin" title="Vàng">🪙 <span id="val-coin">0</span></div>
      </div>
      <div id="account-btn" class="nav-icon-btn me-2" role="button"></div>
    </div>
  </header>

  <div class="container qatt-container">
    <div id="app-container"></div>
  </div>

  <div id="fixed-bottom-controls" class="fixed-bottom-bar">
    <div class="d-grid">
      <button id="main-action-btn"
        class="btn btn-info btn-lg shadow-lg fw-bold py-3"
        >
        Bắt đầu học
      </button>
    </div>
  </div>`;
    this.mainContainer = document.getElementById("app-container");
    this.bottomBar = document.getElementById("fixed-bottom-controls");
	  
    document.getElementById("main-action-btn").addEventListener("click", () => this.startLessonDirectly());
    document.getElementById("account-btn").addEventListener("click", () => this.onAccount());
    this.updateAccountButton();
    document.getElementById("library-btn").addEventListener("click", () => this.backUrl ? (location.href = this.backUrl) : this.renderLibrary());
	  
    this.setupAudio();
    this.setupNavigation();
    this.updateGlobalCounters();
  }
  
  static async init(container, options) {
    const db = new SupabaseService();
    await db.init();
    if (options && options.requireLogin && !(db.user && !db.isAnonymous)) {
      App.renderLoginGate(container, db);
      return null;
    }
    //db.signInWithGoogle()
    const int = setInterval(() => {
    	if (db.user) {
    		clearInterval(int);
    	}
    }, 500);
  	return new App(container, db, options);
  }
  
  // --- account: 👤 not signed in, ✅ signed in (login dialog and sign-out in js/login.js, qatt/js/supabase.js) ---
  isSignedIn() {
    return !!this.db.user && !this.db.isAnonymous;
  }

  updateAccountButton() {
    const button = document.getElementById("account-btn");
    if (!button) return;
    const signedIn = this.isSignedIn();
    button.textContent = signedIn ? "✅" : "👤";
    button.title = signedIn ? `Signed in as ${this.db.user.email || "you"}` : "Not signed in";
  }

  async onAccount() {
    if (!window.QattLogin) return;
    if (!this.isSignedIn()) return QattLogin.open(this.db, "Sign in to keep your score and your decks on every device. What you have so far stays with your account.");
    if (confirm(`Signed in as ${this.db.user.email || "you"}.\nSign out?`)) {
      await this.db.signOut();
      location.reload();
    }
  }

  // the page for users who are not signed in (the practice is for signed-in users only)
  static renderLoginGate(container, db) {
    container.innerHTML = `
      <div class="container qatt-container" style="max-width: 32rem">
        <div class="card p-4 text-center mt-4">
          <h4 class="fw-bold mb-3">Practice</h4>
          <p class="mb-4">Sign in to practice. Your score goes to the leaderboard and stays with your account.</p>
          <button id="practice-login" class="btn btn-info btn-lg fw-bold">Sign in</button>
          <p id="practice-login-note" class="small text-secondary mt-3 mb-0" hidden></p>
        </div>
      </div>`;
    const button = document.getElementById("practice-login");
    if (!window.QattLogin || !db.client) {
      button.disabled = true;
      const note = document.getElementById("practice-login-note");
      note.textContent = "The sign-in is not available right now. Please try again later.";
      note.hidden = false;
      return;
    }
    button.addEventListener("click", () => QattLogin.open(db, "Sign in to practice. What you have so far stays with your account."));
    // the link of an email opened in another tab signs in here as well
    db.client.auth.onAuthStateChange((event, session) => {
      if (session && session.user && session.user.is_anonymous === false) location.reload();
    });
  }

  refreshCurrentView(state = null) {
    const currentState = state || history.state || { view: 'library' };
    const view = currentState.view || 'library';
    
    if (view === 'library') this.renderLibrary(true);
    else if (view === 'preview') this.renderLessonPreview(currentState.lessonId, true);
    else if (view === 'practice') this.renderPractice(true);
    else if (view === 'full') this.renderFullView(true);
    else if (view === 'leaderboard') this.renderLeaderboard(true);
  }

  // --- VIEWS ---
  renderLibrary(isPop = false) {
    if (this.backUrl) { location.href = this.backUrl; return; }
    if (!isPop) history.pushState({ view: 'library' }, '');
    this.currentLesson = null;
    this.bottomBar.style.display = "none";
    this.clearHintTimer();

    let html = "";
    
    if (this.useDB) html += `
      <div id="practice-navbar" class="fade-in alert py-0 shadow">
       		<div class="text-center mb-3">
		         <div class="me-2 btn btn-sm btn-outline-warning" onclick="app.renderLeaderboard()">Bảng xếp hạng</div>
         		<button class="btn btn-sm btn-outline-light" onclick="app.renderFullView()">
           			Mục lục
         		</button>
        </div>
      	</div>
        `;

    this.categories.forEach(category => {
      html += `
        <div class="category-title">${category}</div>
        <div class="row g-3">`;

      Object.values(this.lessons)
        .filter(lesson => lesson.category === category)
        .forEach(lesson => {
          const progress = this.getLessonProgress(lesson.id);
          html += `
            <div class="col-12 lesson-${lesson.id}">
              <div class="card p-3 lesson-card ${lesson.classes}" onclick="app.renderLessonPreview('${lesson.id}')">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="flex-grow-1 me-3">
                    <h5 class="fw-bold mb-1">${lesson.name}</h5>
                    <small class="opacity-50 mt-1 d-block">${lesson.symbols.length} chữ</small>
                  </div>
                  <div class="d-flex flex-column align-items-stretch">
                  ${lesson.thumb?'<div id="thumb-'+lesson.id+'" class="lesson-thumbnail"></div>':''}
                  <div class="progress mt-1">
                    <div class="progress-bar bg-info" role="progressbar" style="width: ${progress}%;" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
                  </div>
                  </div>
                </div>
              </div>
            </div>`;
        });
      html += `
      	</div>`;
    });

    this.mainContainer.innerHTML = html + `</div>`;

    Object.values(this.lessons).forEach(lesson => { 
      const thumbElement = document.getElementById(`thumb-${lesson.id}`);
      if (thumbElement) {
        this.renderToElement(lesson.thumb, this.getActiveStyle(lesson), thumbElement, true);
      }
    });

    this.updateGlobalCounters();
  }

  // from the practice back to the overview of the lesson (a single deck) or to the list of lessons
  leavePractice() {
    this.clearHintTimer();
    if (this.backUrl && this.currentLesson) this.renderLessonPreview(this.currentLesson.id);
    else this.renderLibrary();
  }

  renderLessonPreview(lessonId, isPop = false) {
    history[isPop?'replaceState':'pushState']({ view: 'preview', lessonId: lessonId }, '');
    this.currentLesson = this.lessons[lessonId];
	console.log(lessonId, this.lessons);
    this.bottomBar.style.display = "block";

    const lessonClass = `lesson-${lessonId}`;
    this.mainContainer.innerHTML = `
      <div class="fade-in ${lessonClass}">
        <button onclick="app.renderLibrary()" class="back-link btn btn-link text-white-50 text-decoration-none mb-2 p-0">
          ← Quay lại
        </button>
        ${this.backUrl ? '<button onclick="app.renderLeaderboard()" class="btn btn-sm btn-outline-warning float-end">Bảng xếp hạng</button>' : ''}
        <div class="card p-4 preview-container">
          <div class="mb-4">
            <h3 class="fw-bold">${this.currentLesson.name}</h3>
            <div class="progress">
              <div class="progress-bar bg-info"></div>
            </div>
          </div>
          <div class="row g-3" id="words-grid"></div>
        </div>
      </div>`;

    this.renderStatus(document.querySelector(".preview-container"));
    
    const activeStyle = this.getActiveStyle(this.currentLesson);
    const gridElement = document.getElementById("words-grid");

    this.currentLesson.symbols.forEach(word => {
        const column = document.createElement("div"); 
        column.className = "col-6 col-sm-4";
        
        const card = document.createElement("div"); 
        card.className = "word-grid-item";
        
        if (this.stats[word].c >= 3) {
          card.style.borderColor = "rgba(74, 222, 128, 0.4)";
        }

        this.renderToElement(word, activeStyle, card);
        card.insertAdjacentHTML('beforeend', this.getProgressEmoji(word, false, 'grid'));
        gridElement.appendChild(column).appendChild(card);
    });
  }


  renderPractice(isPop = false, keepWord = false) {
    if (this.currentEnergy <= 0) {
      this.mainContainer.innerHTML = `
        <div class="card p-5 text-center">
          <h2>Hết năng lượng!</h2>
          <button class="btn btn-primary mt-3" onclick="app.startLessonDirectly()"> Thử lại </button>
        </div>`;
      return;
    }
    if (!this.currentLesson) return;
    let unfinishedSymbols = this.currentLesson.symbols.filter(symbol => this.stats[symbol].c < this.opts.requiredCorrect);
    if (unfinishedSymbols.length === 0) {
      if ((this.currentLesson.practiceModeItems||[]).length == 0) {
        this.renderLessonPreview(this.currentLesson.id, true);
        return;
      }
      else unfinishedSymbols = this.currentLesson.practiceModeItems;
    }

    if (!isPop) history.pushState({ view: 'practice' }, '');
    this.bottomBar.style.display = "none";
    
    if (!keepWord) {
      const poolLimit = Math.min(unfinishedSymbols.length, this.opts.learningWindow);
      let selectedWord;
      
      if (unfinishedSymbols.length > 1) {
        let tries = 0;
        do {
          tries++;
          selectedWord = unfinishedSymbols[Math.floor(Math.random() * poolLimit)];
        } while (tries < 20 && selectedWord === this.lastPracticeWord);
      } else {
        selectedWord = unfinishedSymbols[0];
      }
      
      this.activePracticeWord = selectedWord;
      this.lastPracticeWord = selectedWord;
	}
	  
    const correctWord = this.activePracticeWord;
    const forms = this.pickForms(correctWord);
    const activeStyle = this.getActiveStyle(this.currentLesson);
    const lessonClass = `lesson-${this.currentLesson.id}`;

    this.mainContainer.innerHTML = `
      <div class="fade-in ${lessonClass}">
        <button onclick="app.leavePractice()" class="btn btn-link text-white-50 text-decoration-none mb-2 p-0">
          ← Quay lại
        </button>
        <div class="card p-4 practice-container overflow-hidden">
          <div class="d-flex justify-content-between mb-1">
            <h5 class="fw-bold opacity-50">${this.currentLesson.name}</h5>
            
            <div class="energy-display d-flex align-items-center"></div>
          </div>
          <div class="progress mb-4">
            <div class="progress-bar bg-info"></div>
          </div>
          <div class="symbol-card mb-4" id="q-box">
            <button class="reload-practice-btn" onclick="app.renderPractice(true)">↻</button>
            <div id="emoji-c">${this.getProgressEmoji(correctWord, false, 'practice')}</div>
            <div id="feedback" class="feedback-area"></div>
          </div>
          <div class="options" id="opts"></div>
        </div>
      </div>`;

    this.renderStatus(document.querySelector(".practice-container"));
    
    const questionBox = document.getElementById("q-box");
    const questionWrapper = document.createElement("div");

    this.renderForm(forms.q, correctWord, questionWrapper, true);

    questionBox.prepend(questionWrapper);
    this.renderOptions(correctWord, forms);
    this.startHintTimer(correctWord);
  }

  renderOptions(correctWord, forms) {
    const optionsContainer = document.getElementById("opts");
    // only words that can be shown in the form of the answer, and not twice the same answer
    const symbols = this.currentLesson.symbols.filter(s => s === correctWord || this.isDistractor(s, correctWord, forms.a));
    
    let unfinishedSymbols = symbols.filter(s => this.stats[s].c < 3);
    (this.currentLesson.practiceModeItems||[]).forEach(itm => {
        if (unfinishedSymbols.length < this.opts.learningWindow && itm != correctWord) unfinishedSymbols.push(itm);
    });
    const windowPool = unfinishedSymbols.slice(0, this.opts.learningWindow);
    
    const windowDistractors = windowPool
      .filter(s => s !== correctWord)
      .sort(() => 0.5 - Math.random())
      .slice(0, 2);
    
    const fullPool = symbols
      .filter(s => s !== correctWord && !windowDistractors.includes(s))
      .sort(() => 0.5 - Math.random());
    
    const globalDistractor = fullPool.length > 0 ? [fullPool[0]] : [];
    
    let selectedOptions = [correctWord, ...windowDistractors, ...globalDistractor];
    if (selectedOptions.length < 4) {
      const remaining = symbols
        .filter(s => !selectedOptions.includes(s))
        .sort(() => 0.5 - Math.random());
      selectedOptions = [...selectedOptions, ...remaining.slice(0, 4 - selectedOptions.length)];
    }

    selectedOptions.sort(() => 0.5 - Math.random());

    selectedOptions.forEach(option => {
      const button = document.createElement("button"); 
      button.className = "btn"; 
      button.dataset.word = option;
      
      const wrapper = document.createElement("div");
      this.renderForm(forms.a, option, wrapper, false);
      
      button.appendChild(wrapper);
      button.onclick = () => {
        this.clearHintTimer(); 
        const isCorrect = option === correctWord; 
        this.makeSound(isCorrect ? 'success' : 'error');
        let isMilestone = false;
        
        if ((this.currentLesson.practiceModeItems||[]).includes(correctWord)){
          // Remove from list of words to test
          if (isCorrect || Math.random() < .5) {
            this.currentLesson.practiceModeItems = this.currentLesson.practiceModeItems.filter(itm => itm != correctWord);
          }
        }

		const animations = {};
        if (isCorrect) {
            const prevCorrectCount = this.stats[correctWord].c || 0; 
            this.stats[correctWord].c++;
			animations.total = true;
            if (prevCorrectCount === 0) { 
			  animations.drop = true;
              this.stats._score += 10; 
            }
			else if (prevCorrectCount === 1) {
			  animations.seedling = true;
              this.stats._score += 15;
			}
			else if (prevCorrectCount === 2) { 
			  animations.plant = true;
              this.stats._score += 25;
			}
            else if (prevCorrectCount === 3) { 
			  animations.sunflower = true;
              this.stats._score += 200; 
              isMilestone = true;
              if (this.currentEnergy < 5) this.currentEnergy++; 
            } else if (prevCorrectCount < 10) {
			  animations.coin = true;
              this.stats._score += 20;
            }
			else {
			  animations.gem = true;
			  this.stats._score += 20;
			}
            this.syncScore();
            document.getElementById("emoji-c").innerHTML = this.getProgressEmoji(correctWord, true, 'practice');
        } else { 
            this.stats[correctWord].w++; 
            this.stats._score = Math.max(0, this.stats._score - 1); 
            this.currentEnergy--; 
            this.triggerHeartLossAnimation(); 
        }

        localStorage.setItem('qatt_stats', JSON.stringify(this.stats)); 
        this.renderStatus(document.querySelector(".practice-container"), animations);
        
        document.querySelectorAll("#opts .btn").forEach(btn => { 
          btn.disabled = true; 
          if (btn.dataset.word === correctWord) {
            btn.style.backgroundColor = "var(--good-bg)";
            btn.style.borderColor = "var(--good)";
          } else if (btn.dataset.word === option) {
            btn.style.backgroundColor = "var(--bad-bg)";
            btn.style.borderColor = "var(--accent)";
          }
        });

        const feedbackArea = document.getElementById("feedback"); 
        let feedbackHtml = `<h2 class="fw-bold" style="color:${isCorrect ? 'var(--good)' : 'var(--accent)'}">
            ${isCorrect ? 'Đúng! ✨' : 'Sai 😅'}
          </h2>`;
        
        if (isMilestone) {
          feedbackHtml += `<div class="plus-one-heart">+1 ❤️</div>`;
        }

        feedbackArea.innerHTML = feedbackHtml;
        feedbackArea.classList.add("float-up-fade");
        
        setTimeout(() => this.renderPractice(true), isMilestone ? 1800 : 1200);
      };
      optionsContainer.appendChild(button);
    });
      }

      // --- HELPERS ---
  async syncScore() {
  	if (!this.db.user) return; // Wait, until Auth is ready 
	const username = this.getUsername();
  	await this.db.saveScore(username, this.stats._score || 0, 0);
  }
  
  updateGlobalCounters(animations = {}) {
    let counts = {drop: 0, seedling: 0, plant: 0, sunflower: 0, coin: 0};
    Object.keys(this.stats).forEach(key => {
      if (key === '_score') return;
      const symbolStats = this.stats[key];
      if (symbolStats.c > 4) counts.coin++;
	  else if (symbolStats.c === 4) counts.sunflower++
	  else if (symbolStats.c === 3) counts.plant++
      else if (symbolStats.c === 2) counts.seedling++;
      else if (symbolStats.c === 1) counts.drop++;
    });

    this.updateBadge('total', Math.floor(this.stats._score || 0), animations.total);
	this.updateBadge('coin', counts.coin, animations.coin);
    this.updateBadge('sunflower', counts.sunflower, animations.sunflower);
    this.updateBadge('plant', counts.plant, animations.plant);
	this.updateBadge('seedling', counts.seedling, animations.seedling);
    this.updateBadge('drop', counts.drop, animations.drop);
  }

  updateBadge(id, value, shouldAnimate) { 
    const valueEl = document.getElementById(`val-${id}`); 
    const badgeEl = document.getElementById(`badge-${id}`); 
    if (valueEl) valueEl.textContent = value; 
    if (shouldAnimate && badgeEl) { 
      badgeEl.classList.add('pop'); 
      setTimeout(() => badgeEl.classList.remove('pop'), 600); 
    } 
  }

  renderStatus(container, animations = {}) {
    if (!container) return; 
    const progressBar = container.querySelector(".progress-bar"); 
    const energyDisplay = container.querySelector(".energy-display");

    if (progressBar && this.currentLesson) {
      let doneCount = 0;
      let practiceLength = 0;
      let afterFinishRemaining = (this.currentLesson.practiceModeItems||[]).length;
      if (afterFinishRemaining) {
        // Practice mode
        doneCount = this.currentLesson.practiceLength - afterFinishRemaining;
        practiceLength = this.currentLesson.practiceLength;
      } else {
		// THESE ARE NOT POINTS!!!!
		// THIS IS ONLY FOR DECIDING
		// THE AMOUNT OF VISUAL FEEDBACK
		// ON THE PROGRESS BAR
        // Learning mode, in learning mode practice length is calculated dynamically
        doneCount = 65 * this.currentLesson.symbols.filter(symbol => this.stats[symbol].c >= 4).length;
		doneCount = 15 * this.currentLesson.symbols.filter(symbol => this.stats[symbol].c >= 3).length;
        doneCount += 10 * this.currentLesson.symbols.filter(symbol => this.stats[symbol].c >= 2).length;
        doneCount += 10 * this.currentLesson.symbols.filter(symbol => this.stats[symbol].c >= 1).length;
        practiceLength = 100 * this.currentLesson.symbols.length;
      }
      const percentage = Math.round((doneCount / practiceLength) * 100);
      progressBar.style.width = `${percentage}%`;
    }

    if (energyDisplay) {
      
      let heartsHtml = `
        
      `; 
      for (let i = 0; i < 5; i++) {
        heartsHtml += `<span class="energy-heart ${i >= this.currentEnergy ? 'lost' : ''}">❤️</span>`; 
      }
      energyDisplay.innerHTML = heartsHtml + `
        <div class="ms-2 timer-wrapper">
          <div id="timer-pie" class="timer-pie timer-active"></div>
        </div>
        `; 
    }
    this.updateGlobalCounters(animations);
  }

  triggerHeartLossAnimation() {
    const energyDisplay = document.querySelector(".energy-display");
    if (!energyDisplay) return;

    const hearts = energyDisplay.querySelectorAll(".energy-heart:not(.lost)");
    const targetHeart = hearts.length > 0 ? hearts[hearts.length - 1] : energyDisplay;
    
    const rect = targetHeart.getBoundingClientRect();
    const flyHeart = document.createElement("div");
    flyHeart.className = "heart-fly-loss";
    flyHeart.textContent = "❤️";
    
    flyHeart.style.left = (rect.left + rect.width / 2) + "px";
    flyHeart.style.top = rect.top + "px";
    flyHeart.style.position = "fixed"; 
    
    document.body.appendChild(flyHeart);
    setTimeout(() => flyHeart.remove(), 1100);
    this.makeSound('error');
  }




  getLessonProgress(lessonId) {
    const lesson = this.lessons[lessonId]; 
    if (!lesson) return 0; 
    const finishedCount = lesson.symbols.filter(symbol => this.stats[symbol].c >= 3).length;
    return Math.round((finishedCount / lesson.symbols.length) * 100); 
  }
  
  getActiveStyle(lesson) {
    const userStyle = this.globalStyle === "auto" ? "-1" : this.globalStyle;
    if (lesson.style && lesson.style.length > 0) {
      if (lesson.style.includes(userStyle)) return userStyle;
      return String(lesson.style[0]);
    }
    return userStyle;
  }
  
  // --- words of decks ---
  // A word of a lesson is a plain string (quốc ngữ, as in the lessons of the script) or the key of a deck item
  // { n: Nôm, qn: quốc ngữ with one or more syllables } in this.items. A deck item is shown in three forms:
  // "nom" (the characters), "qatt" (one glyph per syllable) and "text" (quốc ngữ).
  textOf(word) {
    return this.items[word]?.qn ?? word;
  }

  // code of a word after the rhyme table of the decoding (null if the word has no glyph)
  getParsedCode(word) {
    const parsed = this.parser.parse(word);
    return parsed ? parsed.qatt : null;
  }

  // codes of all syllables of a word (a syllable without a glyph is left out)
  getCodes(word) {
    return this.textOf(word).split(/\s+/).map(syllable => syllable && this.getParsedCode(syllable)).filter(Boolean);
  }

  // what a word looks like in a form, as a string to compare answers (null if the word has no such form)
  formValue(word, form) {
    if (form === "text") return this.textOf(word);
    if (form === "qatt") return this.getCodes(word).join(" ") || null;
    if (form === "nom") return /[一-鿿㐀-䶿\u{20000}-\u{323af}]/u.test(this.items[word]?.n || "") ? this.items[word].n : null;
    return null;
  }

  // the forms a lesson is asked in: its own, else those of the options, else all three for a deck (null: the lessons of the script)
  formsOf(lesson) {
    return lesson.forms || this.forms || (lesson.items ? ["nom", "qatt", "text"] : null);
  }

  // The forms of the question and of the answers. Lessons of the script: a glyph asked for its text or the other way round.
  // Decks: any two of the forms the word has, so both the characters and the glyphs come up.
  pickForms(word) {
    const forms = this.formsOf(this.currentLesson);
    if (!forms) return Math.random() < 0.5 ? { q: "qatt", a: "text" } : { q: "text", a: "qatt" };
    const have = forms.filter(form => this.formValue(word, form) !== null).sort(() => 0.5 - Math.random());
    return have.length > 1 ? { q: have[0], a: have[1] } : { q: "text", a: "text" };
  }

  // can the word be one of the wrong answers? It needs the form of the answer, and must not look like the right one.
  isDistractor(word, correctWord, form) {
    if (!this.formsOf(this.currentLesson)) return word !== correctWord;
    const value = this.formValue(word, form);
    return value !== null && value !== this.formValue(correctWord, form);
  }

  // shows a word in a form: big as the question, small as an answer
  renderForm(form, word, element, asQuestion) {
    element.innerHTML = "";
    if (form === "qatt") return this.renderToElement(word, null, element, !asQuestion, false);
    if (form === "nom") {
      element.className = "nom-chars" + (asQuestion ? " nom-question" : "");
      element.append(...this.nomChars(this.items[word].n, 220));
      return;
    }
    const text = this.textOf(word);
    if (asQuestion) {
      const title = document.createElement("h1");
      title.className = "fw-bold " + (text.length <= 6 ? "display-1" : text.length <= 12 ? "display-4" : "display-6");
      title.textContent = text;
      element.append(title);
    } else {
      element.textContent = text;
      if (text.length > 10) element.classList.add("small");
    }
  }

  // Nôm characters as images of chunom.org (the Nôm font as fallback); the images exist in the sizes 32 and 220 only
  nomChars(text, size = 220) {
    return [...(text || "")].map(ch => {
      if (!/[一-鿿㐀-䶿\u{20000}-\u{323af}]/u.test(ch)) return document.createTextNode(ch);
      const img = document.createElement("img");
      img.alt = ch;
      img.addEventListener("error", () => img.replaceWith(document.createTextNode(ch)));
      img.src = `https://chunom.org/media/generated/${ch.codePointAt(0).toString(16).toUpperCase()}-${size}.png`;
      return img;
    });
  }

  // The glyph of a word as <qatt-code> elements (qatt.js draws them), one per syllable; a word without a glyph stays as text.
  // style and skipReference are left from the former styles of the script and no longer used.
  renderToElement(word, style, element, skipReference = false, withHint = true) {
    element.innerHTML = "";
    const item = this.items[word];
    const forms = item ? this.formsOf(this.currentLesson) : null; // a deck shows only the forms it asks for
    const codes = !forms || forms.includes("qatt") ? this.getCodes(word) : [];
    if (item && withHint && forms.includes("nom") && this.formValue(word, "nom")) { // overview of a deck: the characters above the glyphs
      const nom = document.createElement("div");
      nom.className = "nom-chars w-100 text-center";
      nom.append(...this.nomChars(item.n, 32));
      element.appendChild(nom);
    }
    if (codes.length) {
        const parent = codes.length > 1 ? Object.assign(document.createElement("div"), { className: "qatt-syllables" }) : element;
        codes.forEach(mainCode => {
            const code = document.createElement("qatt-code");
            code.textContent = mainCode;
            parent.appendChild(code);
        });
        if (parent !== element) element.appendChild(parent);
        if (withHint) {
            const text = document.createElement("div");
            text.className = "w-100 small text-center";
            text.append(this.textOf(word));
            element.appendChild(text);
        }
    } else {
        element.append(this.textOf(word));
    }
  }

  getProgressEmoji(word, shouldAnimate, locationType) { 
    const correctCount = parseInt(this.stats[word].c) || 0; 
    const emoji = correctCount === 0 ? "" : correctCount === 1 ? "💧" : correctCount === 2 ? "🌱" : correctCount == 3 ? "🌿" : correctCount == 4 ? "🌻" : correctCount < 10 ? "🪙" : "💎"; 
    const positionClass = locationType === 'practice' ? 'practice-pos' : 'grid-pos';
    const emptyClass = correctCount === 0 ? 'emoji-empty' : '';
    
    let animationClass = '';
    if (shouldAnimate && correctCount > 0) {
      animationClass = (correctCount == 4) ? "sunflower-milestone" : (correctCount > 4) ? 'milestone' : 'symbol-animate';
    }
    
    return `<span class="word-progress-emoji ${positionClass} ${animationClass} ${emptyClass}">${emoji}</span>`; 
  }
    startHintTimer(word) { 
    this.clearHintTimer(); 
    this.hintInterval = setInterval(() => { 
      const correctBtn = [...document.querySelectorAll(".options .btn")].find(btn => btn.dataset.word === word); 
      if (correctBtn) { 
        correctBtn.classList.add('hint-shake'); 
        setTimeout(() => correctBtn.classList.remove('hint-shake'), 800); 
        this.currentEnergy--; 
        this.triggerHeartLossAnimation(); 
        this.renderStatus(document.querySelector(".practice-container")); 
        if (this.currentEnergy <= 0) this.renderPractice(true); 
      } 
    }, 10000); 
  }

  clearHintTimer() { 
    if (this.hintInterval) clearInterval(this.hintInterval); 
  }

  setupAudio() { 
    window.addEventListener('click', () => { 
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); 
    }, { once: true }); 
  }

  makeSound(toneType) { 
    if (!this.audioCtx) return; 
    const oscillator = this.audioCtx.createOscillator(); 
    const gainNode = this.audioCtx.createGain(); 
    oscillator.connect(gainNode); 
    gainNode.connect(this.audioCtx.destination); 
    oscillator.frequency.setValueAtTime(toneType === 'success' ? 440 : 220, this.audioCtx.currentTime); 
    gainNode.gain.setValueAtTime(0.05, this.audioCtx.currentTime); 
    oscillator.start(); 
    oscillator.stop(this.audioCtx.currentTime + 0.2); 
  }

  setupNavigation() { 
    window.onpopstate = (event) => { 
      const state = event.state || { view: 'library' }; 
      if (state.view === 'library') this.renderLibrary(true); 
      else if (state.view === 'preview') this.renderLessonPreview(state.lessonId, true); 
    }; 
  }
  
  addLesson(options) {
    const lesson = { id: "", name: "", symbols: [], category: "", style: [], ...options };
    this.lessons[lesson.id] = lesson;
    Object.assign(this.items, lesson.items || {});
    if (!this.categories.includes(lesson.category)) {
      this.categories.push(lesson.category);
    }
    lesson.symbols.forEach(symbol => { 
      if (!this.stats[symbol]) this.stats[symbol] = { c: 0, w: 0 }; 
    });
  }

  startLessonDirectly() { 
    this.currentEnergy = 5;
	  console.log(this.curentLesson);
    const lesson = JSON.parse(JSON.stringify(this.currentLesson));
    let unfinishedSymbols = lesson.symbols.filter(symbol => this.stats[symbol].c < 3);
    if (unfinishedSymbols.length == 0) {
      lesson.isFinished = true;
      lesson.practiceModeItems = JSON.parse(JSON.stringify(lesson.symbols));
      lesson.practiceLength = lesson.practiceModeItems.length;
    } else lesson.practiceLength = unfinishedSymbols.length;
    this.currentLesson = lesson;
    this.renderPractice(); 
  }

  renderFullView(isPop = false) {
    if (!isPop) history.pushState({ view: 'full' }, '');
    this.bottomBar.style.display = "none";
    this.mainContainer.innerHTML = `
      <div class="fade-in">
        <button class="btn btn-link text-white-50 text-decoration-none mb-3 p-0" onclick="app.renderLibrary()">
          ← Quay lại
        </button>
        <div id="full-grid"></div>
      </div>`;

    const fullGrid = document.getElementById("full-grid");
    Object.values(this.lessons).forEach(lesson => {
      const lessonDiv = document.createElement("div"); 
      lessonDiv.className = `lesson-${lesson.id} mb-4 p-3 card`;
      lessonDiv.innerHTML = `
        <h6 class="fw-bold opacity-50 mb-3">${lesson.name}</h6>
        <div class="row g-2" id="grid-${lesson.id}"></div>`;
      
      lesson.symbols.forEach(word => {
        const column = document.createElement("div"); 
        column.className = "col-4 col-sm-2";
        const card = document.createElement("div"); 
        card.className = "word-grid-item";
        
        this.renderToElement(word, this.getActiveStyle(lesson), card);
        card.insertAdjacentHTML('beforeend', this.getProgressEmoji(word, false, 'grid'));
        lessonDiv.querySelector(`#grid-${lesson.id}`).appendChild(column).appendChild(card);
      });
      fullGrid.appendChild(lessonDiv);
    });
  }
  
renderLeaderboard(isPop = false) {
  if (!isPop) history.pushState({ view: 'leaderboard' }, '');
  this.bottomBar.style.display = "none";
  this.mainContainer.innerHTML = `
    <div class="fade-in">
      <h4 class="fw-bold mb-4 text-center">Bảng xếp hạng</h4>
      <div id="leaderboard-content" class="card p-4 text-center">⏳</div>
    </div>`;
  
  let html = "";
  this.db.getHybridLeaderboard(10, 3).then(data => {
    html = "";
    let rankBefore = 0;
    data.forEach((row, i) => {
      const hasGap = row.rank - rankBefore > 1 ? true : false;
      rankBefore = row.rank;
      let username = this.getUsername(row.username, row.user_id);
		if (username.length > 40) username = username.substr(0, 40);
		username = username.replace(/[^\p{L}\p{N}\-_\s]/ug, "").replace(/[<>"'&]/g, "");
      if (hasGap) {
        html += `
          <tr><td colspan="3">...</td></tr>
        `;
      }
      	html += `
    	<tr style="${row.user_id == this.db.user.id ? '' : 'opacity:.85'}">
    		<td>
    		  (${row.rank})
    		</td>
    		<td class="fw-bold" style="font-size:1.1em">
      			${row.score}
      			${row.rank == 1 ? '' : ''}
    		</td>
    		<th class="${row.user_id == this.db.user.id ? 'text-warning' : ''}">
    	  		<div class="text-truncate">${username}</div>
      			<div class="small text-muted">
        			${new Date(row.updated_at||null).toISOString().replace('T', ' ').split('.')[0].slice(0, -3)}
      			</div>
    		</th>
    	</tr>
      	`;
    });

	
    this.mainContainer.innerHTML = `
    	
    <div id="practice-account" class="mx-2 mt-3"></div>
    <div class="mx-2 my-3">
      Tên của bạn: <b>${this.getUsername()}</b> (<span class="text-decoration-underline" onclick="app.setNickname()" class="text-light cursor-pointer">chỉnh sửa tên</span>)
    </div>
    
    <table class="table rounded">
    		<tr>
    			<th>Rank</th>
    			<th>Score</th>
    			<th>Username</th>
    		</tr>
    		${html}
    	</table>`;
    if (window.QattLogin) QattLogin.status(this.db, document.getElementById('practice-account'));
  });
}

getUsername(username, uuid) {
	if (username == null && uuid == null) {
		username = this.username;
		uuid = this.db.user ? this.db.user.id : null;
		if (!uuid) return username || "Anonymous";
	}
	if (username && username != "Anonymous") return  username;
	if (!uuid) return "Anonymous";
    const adjectives = [
        "Fast", "Cool", "Wild", "Smart", "Glad", 
        "Brave", "Soft", "Bold", "Bright", "Swift",
        "Tiny", "Fluffy", "Quick", "Light", "Noble", 
        "Sharp", "Keen", "True", "Lucky", "Free"
    ];

    const nouns = [
        "Cat", "Eagle", "Fox", "Bear", "Lion", 
        "Goose", "Camel", "Wolf", "Hare", "Owl",
        "Lynx", "Koala", "Deer", "Dino", "Squirrel", 
        "Hippo", "Raven", "Pug", "Seal", "Gecko"
    ];

    const hexPart = uuid.substring(0, 5);
    const val = parseInt(hexPart.substring(0, 3), 16);

    const adjIndex = val % adjectives.length;
    const nounIndex = Math.floor(val / adjectives.length) % nouns.length;
    const suffix = parseInt(hexPart.slice(3, 5), 16) || 1;
    return `${adjectives[adjIndex]}${nouns[nounIndex]}_${suffix}`;
}


	
  setNickname() {
    let newname = prompt('Chọn tên mới', localStorage.username || this.username);
	console.log("about to change username to", newname);
	if (!newname) return;
	  console.log("changing...");
	  newname = newname.trim().replace(/[^\p{L}\p{N}\-_\s]/ug, "").replace(/[\x00-\x1F\x7F&<>"']/g, "").replace(/\s+/g, " ");
	  console.log("cleaned name", newname);
	  if (newname.length < 2) return;
	  if (newname.length > 40) newname = newname.substr(0, 30);
	  console.log("truncating to", newname);
	this.username = newname;
	localStorage.username = newname;
	console.log("username changed to", localStorage.username);
    setTimeout(() => this.refreshCurrentView(),1000);
	this.db.setNickname(newname);
  }
	
	
}
