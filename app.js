"use strict";

(() => {
  const data = window.TAROT_DATA;

  if (!data || !Array.isArray(data.cards) || data.cards.length !== 22) {
    console.error("タロットデータを正しく読み込めませんでした。");
    return;
  }

  const elements = {
    drawButton: document.querySelector("#drawButton"),
    reading: document.querySelector("#reading"),
    spread: document.querySelector("#spread"),
    rerollAllButton: document.querySelector("#rerollAllButton"),
    rerollUnlockedButton: document.querySelector("#rerollUnlockedButton"),
    revealAllButton: document.querySelector("#revealAllButton"),
    copyButton: document.querySelector("#copyButton"),
    cardTemplate: document.querySelector("#cardTemplate"),
    toast: document.querySelector("#toast")
  };

  let spreadState = [];
  let spreadVersion = 0;
  let toastTimer = 0;

  function randomInteger(max) {
    if (max <= 0) return 0;

    if (window.crypto && window.crypto.getRandomValues) {
      const range = 0x100000000;
      const limit = range - (range % max);
      const buffer = new Uint32Array(1);
      do {
        window.crypto.getRandomValues(buffer);
      } while (buffer[0] >= limit);
      return buffer[0] % max;
    }

    return Math.floor(Math.random() * max);
  }

  function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInteger(index + 1);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function sample(items, count) {
    return shuffled(items).slice(0, Math.min(count, items.length));
  }

  function getCard(cardNumber) {
    return data.cards.find((card) => card.number === cardNumber);
  }

  function getCategory(categoryId) {
    return data.categories.find((category) => category.id === categoryId);
  }

  function drawCardNumbers(count, excludedNumbers = []) {
    const excluded = new Set(excludedNumbers);
    const available = data.cards
      .map((card) => card.number)
      .filter((cardNumber) => !excluded.has(cardNumber));

    if (available.length < count) {
      throw new Error("抽選できるカードが不足しています。");
    }

    return sample(available, count);
  }

  function createResult(categoryId, cardNumber, locked = false) {
    const orientation = randomInteger(2) === 0 ? "upright" : "reversed";
    return {
      categoryId,
      cardNumber,
      orientation,
      locked,
      revealed: false,
      lines: []
    };
  }

  function findContradictionLine() {
    const personalityResult = spreadState.find((result) => result.categoryId === "personality");
    if (!personalityResult) return "表に見える性格と、本人が隠す弱さは必ずしも同じ方向を向いていない。";

    const card = getCard(personalityResult.cardNumber);
    const reading = card[personalityResult.orientation];
    const candidates = reading.tags.flatMap((tag) => data.contradictions[tag] || []);

    if (candidates.length === 0) {
      return "普段の選択を支える長所が、余裕を失った時には本人を縛る弱点へ変わる。";
    }

    return candidates[randomInteger(candidates.length)];
  }

  function pickOne(items) {
    return items[randomInteger(items.length)];
  }

  function labelSentence(label, sentence, removablePrefixes = []) {
    const prefix = removablePrefixes.find((candidate) => sentence.startsWith(candidate));
    const content = prefix ? sentence.slice(prefix.length) : sentence;
    return `${label}：${content}`;
  }

  function generateAppearanceLines(result) {
    const profile = data.practicalProfiles[result.cardNumber].appearance;
    const style = data.practicalStyles[result.cardNumber][result.orientation];
    const details = data.characterDetails[result.cardNumber][result.orientation];
    const featurePool = result.orientation === "upright"
      ? profile.uprightFeatures
      : profile.reversedFeatures;

    return [
      `年齢感：${pickOne(profile.ages)}`,
      `体格：${pickOne(profile.builds)}`,
      `服装：${style.clothing}`,
      `髪・身だしなみ：${style.grooming}`,
      `外見上の特徴：${pickOne(featurePool)}`,
      `傷跡など：${details.scar}`
    ];
  }

  function generateOccupationLines(result, readingPool) {
    const jobPool = data.practicalProfiles[result.cardNumber].occupations[result.orientation];
    const details = data.characterDetails[result.cardNumber][result.orientation];

    return [
      `職業・立場：${pickOne(jobPool)}。`,
      `経歴：${details.background}`,
      `仕事ぶり：${readingPool[1]}`,
      labelSentence("生活リズム", readingPool[2], ["生活リズムは", "生活は"]),
      `収入・資産：${details.finance}`
    ];
  }

  function generatePersonalityLines(result, readingPool, count) {
    const details = data.characterDetails[result.cardNumber][result.orientation];
    return [
      `好きなもの：${sample(details.likes, 2).join("、")}。`,
      `嫌いなもの：${sample(details.dislikes, 2).join("、")}。`,
      ...sample(readingPool, count - 2)
    ];
  }

  function generateRelationshipLines(result, readingPool, count) {
    const details = data.characterDetails[result.cardNumber][result.orientation];
    return [
      `家族＆友人：${details.connections}`,
      ...sample(readingPool, count - 1)
    ];
  }

  function generateWoundLines(result, readingPool, count) {
    const details = data.characterDetails[result.cardNumber][result.orientation];
    return [
      `負傷・健康：${details.injury}`,
      ...sample(readingPool, count - 2),
      findContradictionLine()
    ];
  }

  function generateLines(result) {
    const category = getCategory(result.categoryId);
    const card = getCard(result.cardNumber);
    const readingPool = card[result.orientation].readings[result.categoryId];
    let lines;

    if (result.categoryId === "appearance") {
      lines = generateAppearanceLines(result);
    } else if (result.categoryId === "occupation") {
      lines = generateOccupationLines(result, readingPool);
    } else if (result.categoryId === "personality") {
      lines = generatePersonalityLines(result, readingPool, category.pick);
    } else if (result.categoryId === "relationships") {
      lines = generateRelationshipLines(result, readingPool, category.pick);
    } else if (result.categoryId === "wounds") {
      lines = generateWoundLines(result, readingPool, category.pick);
    } else {
      lines = sample(readingPool, category.pick);
    }

    return lines;
  }

  function generateAllLines() {
    spreadState.forEach((result) => {
      result.lines = generateLines(result);
    });
  }

  function makeFreshSpread() {
    const cardNumbers = drawCardNumbers(data.categories.length);
    spreadState = data.categories.map((category, index) => (
      createResult(category.id, cardNumbers[index])
    ));
    spreadVersion += 1;
    generateAllLines();
  }

  function setText(root, selector, value) {
    root.querySelector(selector).textContent = value;
  }

  function renderSpread() {
    elements.spread.replaceChildren();
    const fragment = document.createDocumentFragment();

    spreadState.forEach((result, index) => {
      const category = getCategory(result.categoryId);
      const card = getCard(result.cardNumber);
      const reading = card[result.orientation];
      const isUpright = result.orientation === "upright";
      const clone = elements.cardTemplate.content.cloneNode(true);
      const article = clone.querySelector(".result-card");
      const tarotButton = clone.querySelector(".tarot");
      const lockButton = clone.querySelector(".lock-button");
      const rerollButton = clone.querySelector(".reroll-button");
      const interpretation = clone.querySelector(".interpretation");
      const list = clone.querySelector(".interpretation__list");

      article.dataset.categoryId = result.categoryId;
      article.classList.toggle("is-locked", result.locked);
      article.classList.toggle("is-revealed", result.revealed);
      article.classList.toggle("is-reversed", !isUpright);

      setText(clone, ".result-card__index", `${category.index} / ${category.subtitle}`);
      setText(clone, ".result-card__category", category.name);
      setText(clone, ".tarot__number", `${card.numeral} · ARCANA ${String(card.number).padStart(2, "0")}`);
      setText(clone, ".tarot__symbol", card.symbol);
      setText(clone, ".tarot__name-ja", card.nameJa);
      setText(clone, ".tarot__name-en", card.nameEn);
      setText(clone, ".tarot__orientation", isUpright ? "正位置" : "逆位置");
      setText(clone, ".tarot__tags", reading.tags.join("・"));

      tarotButton.setAttribute(
        "aria-label",
        result.revealed
          ? `${category.name}：${card.nameJa}、${isUpright ? "正位置" : "逆位置"}`
          : `${category.name}のカードをめくる`
      );
      tarotButton.setAttribute("aria-expanded", String(result.revealed));

      lockButton.setAttribute("aria-pressed", String(result.locked));
      setText(clone, ".lock-button__icon", result.locked ? "◆" : "◇");
      setText(clone, ".lock-button__label", result.locked ? "固定中" : "固定");
      lockButton.setAttribute("aria-label", `${category.name}を${result.locked ? "固定解除" : "固定"}`);
      rerollButton.disabled = result.locked;

      result.lines.forEach((line, lineIndex) => {
        const item = document.createElement("li");
        item.textContent = line;
        if (result.categoryId === "wounds" && lineIndex === result.lines.length - 1) {
          item.classList.add("is-context");
        }
        list.append(item);
      });

      interpretation.hidden = !result.revealed;
      tarotButton.addEventListener("click", () => revealOne(result.categoryId, article));
      lockButton.addEventListener("click", () => toggleLock(result.categoryId, article));
      rerollButton.addEventListener("click", () => rerollOne(result.categoryId));
      fragment.append(clone);

      if (index === spreadState.length - 1) {
        // DOMへの追加はループ後にまとめて行います。
      }
    });

    elements.spread.append(fragment);
    updateToolbar();
  }

  function revealOne(categoryId, article) {
    const result = spreadState.find((item) => item.categoryId === categoryId);
    if (!result || result.revealed) return;

    result.revealed = true;
    article.classList.add("is-revealed");
    const tarotButton = article.querySelector(".tarot");
    const interpretation = article.querySelector(".interpretation");
    const card = getCard(result.cardNumber);
    const category = getCategory(categoryId);

    tarotButton.setAttribute("aria-expanded", "true");
    tarotButton.setAttribute(
      "aria-label",
      `${category.name}：${card.nameJa}、${result.orientation === "upright" ? "正位置" : "逆位置"}`
    );
    window.setTimeout(() => {
      interpretation.hidden = false;
    }, 280);
    updateToolbar();
  }

  function toggleLock(categoryId, article) {
    const result = spreadState.find((item) => item.categoryId === categoryId);
    if (!result) return;

    result.locked = !result.locked;
    article.classList.toggle("is-locked", result.locked);
    const button = article.querySelector(".lock-button");
    const icon = button.querySelector(".lock-button__icon");
    const label = button.querySelector(".lock-button__label");
    const category = getCategory(categoryId);

    button.setAttribute("aria-pressed", String(result.locked));
    button.setAttribute("aria-label", `${category.name}を${result.locked ? "固定解除" : "固定"}`);
    icon.textContent = result.locked ? "◆" : "◇";
    label.textContent = result.locked ? "固定中" : "固定";
    article.querySelector(".reroll-button").disabled = result.locked;
    updateToolbar();
    showToast(result.locked ? `${category.name}を固定しました` : `${category.name}の固定を解除しました`);
  }

  function rerollOne(categoryId) {
    const index = spreadState.findIndex((item) => item.categoryId === categoryId);
    if (index < 0 || spreadState[index].locked) return;

    const excludedNumbers = spreadState.map((item) => item.cardNumber);
    const [newCardNumber] = drawCardNumbers(1, excludedNumbers);
    spreadState[index] = createResult(categoryId, newCardNumber);
    spreadVersion += 1;
    spreadState[index].lines = generateLines(spreadState[index]);
    renderSpread();
    showToast(`${getCategory(categoryId).name}を再抽選しました`);
  }

  function rerollAll() {
    makeFreshSpread();
    renderSpread();
    showToast("5枚すべてを再抽選しました（固定は解除されました）");
  }

  function rerollUnlocked() {
    const unlockedIndexes = spreadState
      .map((result, index) => result.locked ? -1 : index)
      .filter((index) => index >= 0);

    if (unlockedIndexes.length === 0) {
      showToast("すべて固定されています。固定を解除してから再抽選してください");
      return;
    }

    const lockedNumbers = spreadState
      .filter((result) => result.locked)
      .map((result) => result.cardNumber);
    const oldUnlockedNumbers = unlockedIndexes.map((index) => spreadState[index].cardNumber);
    const excluded = [...lockedNumbers, ...oldUnlockedNumbers];
    let newCardNumbers;

    try {
      newCardNumbers = drawCardNumbers(unlockedIndexes.length, excluded);
    } catch (_error) {
      newCardNumbers = drawCardNumbers(unlockedIndexes.length, lockedNumbers);
    }

    unlockedIndexes.forEach((stateIndex, drawIndex) => {
      const categoryId = spreadState[stateIndex].categoryId;
      spreadState[stateIndex] = createResult(categoryId, newCardNumbers[drawIndex]);
    });
    spreadVersion += 1;
    unlockedIndexes.forEach((stateIndex) => {
      spreadState[stateIndex].lines = generateLines(spreadState[stateIndex]);
    });
    renderSpread();
    showToast(`未固定の${unlockedIndexes.length}枚を再抽選しました`);
  }

  function revealAll() {
    const articles = [...elements.spread.querySelectorAll(".result-card")];
    const versionAtStart = spreadVersion;
    let newlyRevealed = 0;

    spreadState.forEach((result, index) => {
      if (result.revealed) return;
      newlyRevealed += 1;
      window.setTimeout(() => {
        if (spreadVersion === versionAtStart) revealOne(result.categoryId, articles[index]);
      }, (newlyRevealed - 1) * 90);
    });

    if (newlyRevealed === 0) {
      showToast("すべてのカードはめくられています");
    }
  }

  function orientationLabel(result) {
    return result.orientation === "upright" ? "正位置" : "逆位置";
  }

  function buildCopyText() {
    const header = [
      "キャラクタリウム｜タロット式キャラクター生成ガチャ",
      "================================"
    ];
    const sections = spreadState.map((result) => {
      const category = getCategory(result.categoryId);
      const card = getCard(result.cardNumber);
      const reading = card[result.orientation];
      const lines = result.lines.map((line) => `・${line}`);
      return [
        "",
        `【${category.index}. ${category.name}】`,
        `${card.numeral} ${card.nameJa}（${card.nameEn}）／${orientationLabel(result)}`,
        `意味：${reading.tags.join("・")}`,
        ...lines
      ].join("\n");
    });
    const footer = [
      "",
      "この結果はキャラクター作成のヒントです。気に入らない設定は自由に無視・変更してください。"
    ];
    return [...header, ...sections, ...footer].join("\n");
  }

  async function copyResults() {
    const text = buildCopyText();

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      showToast("結果全文をクリップボードへコピーしました");
    } catch (error) {
      console.error("コピーに失敗しました。", error);
      showToast("コピーできませんでした。ブラウザの権限をご確認ください");
    }
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const succeeded = document.execCommand("copy");
    textarea.remove();
    if (!succeeded) throw new Error("document.execCommand('copy') failed");
  }

  function updateToolbar() {
    const hasResults = spreadState.length > 0;
    const allLocked = hasResults && spreadState.every((result) => result.locked);
    const allRevealed = hasResults && spreadState.every((result) => result.revealed);
    elements.rerollUnlockedButton.disabled = !hasResults || allLocked;
    elements.revealAllButton.disabled = !hasResults || allRevealed;
    elements.copyButton.disabled = !hasResults;
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, 2600);
  }

  function beginReading() {
    makeFreshSpread();
    renderSpread();
    elements.reading.hidden = false;
    elements.drawButton.textContent = "新しく5枚を引く";
    window.requestAnimationFrame(() => {
      elements.reading.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  elements.drawButton.addEventListener("click", beginReading);
  elements.rerollAllButton.addEventListener("click", rerollAll);
  elements.rerollUnlockedButton.addEventListener("click", rerollUnlocked);
  elements.revealAllButton.addEventListener("click", revealAll);
  elements.copyButton.addEventListener("click", copyResults);
  updateToolbar();
})();
