"use strict";

(() => {
  const data = window.TAROT_DATA;
  const constraintData = window.CHARACTER_CONSTRAINT_DATA;
  const minorData = window.MINOR_ARCANA_DATA;

  if (
    !data
    || !Array.isArray(data.cards)
    || data.cards.length !== 22
    || !constraintData
    || !constraintData.elementary
    || !minorData
    || !Array.isArray(minorData.cards)
    || minorData.cards.length !== 56
  ) {
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
    toast: document.querySelector("#toast"),
    constraintsCount: document.querySelector("#constraintsCount"),
    constraintSetting: document.querySelector("#constraintSetting"),
    constraintOrigin: document.querySelector("#constraintOrigin"),
    constraintAge: document.querySelector("#constraintAge"),
    constraintGender: document.querySelector("#constraintGender"),
    constraintRole: document.querySelector("#constraintRole"),
    clearConstraintsButton: document.querySelector("#clearConstraintsButton"),
    activeConstraints: document.querySelector("#activeConstraints"),
    activeConstraintsList: document.querySelector("#activeConstraintsList"),
    nameArcana: document.querySelector("#nameArcana"),
    nameLockButton: document.querySelector("#nameLockButton"),
    nameTarotButton: document.querySelector("#nameTarotButton"),
    nameTarotNumber: document.querySelector("#nameTarotNumber"),
    nameTarotSymbol: document.querySelector("#nameTarotSymbol"),
    nameTarotNameJa: document.querySelector("#nameTarotNameJa"),
    nameTarotNameEn: document.querySelector("#nameTarotNameEn"),
    nameTarotOrientation: document.querySelector("#nameTarotOrientation"),
    nameTarotTags: document.querySelector("#nameTarotTags"),
    nameInterpretation: document.querySelector("#nameInterpretation"),
    nameDirection: document.querySelector("#nameDirection"),
    japaneseNameCandidates: document.querySelector("#japaneseNameCandidates"),
    internationalNameCandidates: document.querySelector("#internationalNameCandidates"),
    nameMotifs: document.querySelector("#nameMotifs"),
    rerollNameButton: document.querySelector("#rerollNameButton")
  };

  let spreadState = [];
  let spreadVersion = 0;
  let toastTimer = 0;
  let activeConstraints = {};
  let nameState = null;

  const constraintFields = [
    { key: "setting", label: "舞台・時代", element: elements.constraintSetting },
    { key: "origin", label: "出身・文化圏", element: elements.constraintOrigin },
    { key: "age", label: "年齢", element: elements.constraintAge, suffix: "歳" },
    { key: "gender", label: "性別・ジェンダー", element: elements.constraintGender },
    { key: "role", label: "職業・立場", element: elements.constraintRole }
  ];

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

  function getMinorCard(cardId) {
    return minorData.cards.find((card) => card.id === cardId);
  }

  function unique(items) {
    return [...new Set(items)];
  }

  function getGenderPreference() {
    const gender = activeConstraints.gender || "";
    if (/女性|女子|少女|女の子|girl|female|woman/i.test(gender)) return "feminine";
    if (/男性|男子|少年|男の子|boy|male|man/i.test(gender)) return "masculine";
    return "neutral";
  }

  function pickNameCandidates(themeKeys, culture, count = 2) {
    const gender = getGenderPreference();
    const themePools = themeKeys
      .map((themeKey) => minorData.nameThemes[themeKey]?.[culture])
      .filter(Boolean);

    if (gender === "neutral") {
      const allNames = unique(themePools.flatMap((pool) => [
        ...pool.neutral,
        ...pool.masculine,
        ...pool.feminine
      ]));
      return sample(allNames, count);
    }

    const alternateGender = gender === "masculine" ? "feminine" : "masculine";
    const priorityGroups = [
      unique(themePools.flatMap((pool) => pool[gender])),
      unique(themePools.flatMap((pool) => pool.neutral)),
      unique(themePools.flatMap((pool) => pool[alternateGender]))
    ];
    const selected = [];

    priorityGroups.forEach((group) => {
      shuffled(group).forEach((name) => {
        if (selected.length < count && !selected.includes(name)) selected.push(name);
      });
    });

    return selected;
  }

  function createNameResult(excludedCardId = "") {
    const available = minorData.cards.filter((card) => card.id !== excludedCardId);
    const card = pickOne(available);
    const orientation = randomInteger(2) === 0 ? "upright" : "reversed";
    const reading = card[orientation];

    return {
      cardId: card.id,
      orientation,
      locked: false,
      revealed: false,
      japaneseNames: pickNameCandidates(reading.nameThemes, "japanese"),
      internationalNames: pickNameCandidates(reading.nameThemes, "international")
    };
  }

  function normalizeConstraintValue(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function readConstraintInputs() {
    return constraintFields.reduce((result, field) => {
      const value = normalizeConstraintValue(field.element.value);
      if (!value) return result;

      if (field.key === "age") {
        const age = Number(value);
        if (Number.isInteger(age) && age >= 0 && age <= 120) {
          result.age = String(age);
        }
        return result;
      }

      result[field.key] = value;
      return result;
    }, {});
  }

  function getConstraintEntries(constraints = activeConstraints) {
    return constraintFields
      .filter((field) => constraints[field.key])
      .map((field) => ({
        key: field.key,
        label: field.label,
        value: `${constraints[field.key]}${field.suffix || ""}`
      }));
  }

  function updateConstraintCount() {
    const count = getConstraintEntries(readConstraintInputs()).length;
    elements.constraintsCount.textContent = count > 0 ? `${count}項目` : "任意";
  }

  function clearConstraintInputs() {
    constraintFields.forEach((field) => {
      field.element.value = "";
    });
    updateConstraintCount();
    showToast(
      spreadState.length > 0
        ? "入力をクリアしました（現在の結果には影響しません）"
        : "入力をクリアしました"
    );
  }

  function renderConstraintSummary() {
    const entries = getConstraintEntries();
    elements.activeConstraintsList.replaceChildren();
    elements.activeConstraints.hidden = entries.length === 0;

    entries.forEach((entry) => {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");
      term.textContent = entry.label;
      description.textContent = entry.value;
      item.append(term, description);
      elements.activeConstraintsList.append(item);
    });
  }

  function getNumericAge() {
    if (!activeConstraints.age) return null;
    const age = Number.parseInt(activeConstraints.age, 10);
    return Number.isInteger(age) && age >= 0 && age <= 120 ? age : null;
  }

  function isElementaryContext() {
    const role = activeConstraints.role || "";
    const age = getNumericAge();
    return /小学生|児童|elementary|primary school/i.test(role)
      || (age !== null && age >= 6 && age <= 12);
  }

  function isModernJapaneseSetting() {
    const setting = activeConstraints.setting || "";
    return setting === "" || /現代.*日本|日本.*現代/.test(setting);
  }

  function getElementaryResources(result) {
    return {
      common: constraintData.elementary.common,
      profile: constraintData.elementary.cardProfiles[result.cardNumber][result.orientation]
    };
  }

  function adaptElementaryLine(line) {
    return line
      .replaceAll("休日", "休みの日")
      .replaceAll("職場", "学校")
      .replaceAll("同僚", "クラスメイト")
      .replaceAll("上司", "先生")
      .replaceAll("部下", "年下の子")
      .replaceAll("仕事", "学校での役目")
      .replaceAll("収入", "お小遣い")
      .replaceAll("財産", "大切な持ち物")
      .replaceAll("専門性", "得意分野")
      .replaceAll("家計や予定", "宿題や予定");
  }

  function isElementaryAppropriate(line, excludedTerms) {
    return !excludedTerms.some((term) => line.includes(term));
  }

  function getElementaryReadingPool(readingPool, categoryId, orientation) {
    const common = constraintData.elementary.common;
    const adapted = readingPool
      .map(adaptElementaryLine)
      .filter((line) => isElementaryAppropriate(line, common.excludedTerms));
    const fallbacks = common.fallbackReadings[categoryId][orientation];
    return [...new Set([...adapted, ...fallbacks])];
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

  function makeFixedAgeLine(orientation) {
    if (!activeConstraints.age) return null;
    const impression = pickOne(constraintData.fixedAgeImpressions[orientation]);
    return `年齢：${activeConstraints.age}歳。${impression}`;
  }

  function generateElementaryAppearanceLines(result) {
    const { common, profile } = getElementaryResources(result);
    const orientation = result.orientation;
    const ageLine = activeConstraints.age
      ? `年齢：${activeConstraints.age}歳。${pickOne(common.ageImpressions[orientation])}`
      : `年齢感：小学生くらい。${pickOne(common.ageImpressions[orientation])}`;

    return [
      ageLine,
      `体格：${pickOne(common.builds)}`,
      `服装：${pickOne(common.clothing[orientation])}`,
      `髪・身だしなみ：${pickOne(common.grooming[orientation])}`,
      `外見上の特徴：${profile.appearance}`,
      `傷跡など：${pickOne(common.scars[orientation])}`
    ];
  }

  function generateAppearanceLines(result) {
    if (isElementaryContext()) {
      return generateElementaryAppearanceLines(result);
    }

    const profile = data.practicalProfiles[result.cardNumber].appearance;
    const style = data.practicalStyles[result.cardNumber][result.orientation];
    const details = data.characterDetails[result.cardNumber][result.orientation];
    const featurePool = result.orientation === "upright"
      ? profile.uprightFeatures
      : profile.reversedFeatures;
    const fixedAgeLine = makeFixedAgeLine(result.orientation);

    return [
      fixedAgeLine || `年齢感：${pickOne(profile.ages)}`,
      `体格：${pickOne(profile.builds)}`,
      `服装：${style.clothing}`,
      `髪・身だしなみ：${style.grooming}`,
      `外見上の特徴：${pickOne(featurePool)}`,
      `傷跡など：${details.scar}`
    ];
  }

  function generateElementaryOccupationLines(result) {
    const { common, profile } = getElementaryResources(result);
    const role = activeConstraints.role
      || (isModernJapaneseSetting() ? "小学生" : "学齢期の子ども");
    const originPrefix = activeConstraints.origin
      ? `${activeConstraints.origin}にルーツがあり、`
      : "";

    return [
      `職業・立場：${role}。`,
      `経歴：${originPrefix}${pickOne(common.backgrounds[result.orientation])}`,
      `学校での様子：${profile.school}`,
      `放課後・生活：${profile.afterSchool}`,
      `お金・持ち物：${profile.belongings}`
    ];
  }

  function generateOccupationLines(result, readingPool) {
    if (isElementaryContext()) {
      return generateElementaryOccupationLines(result);
    }

    const jobPool = data.practicalProfiles[result.cardNumber].occupations[result.orientation];
    const details = data.characterDetails[result.cardNumber][result.orientation];
    const role = activeConstraints.role
      ? `${activeConstraints.role}。`
      : `${pickOne(jobPool)}。`;

    return [
      `職業・立場：${role}`,
      `経歴：${details.background}`,
      `仕事ぶり：${readingPool[1]}`,
      labelSentence("生活リズム", readingPool[2], ["生活リズムは", "生活は"]),
      `収入・資産：${details.finance}`
    ];
  }

  function generatePersonalityLines(result, readingPool, count) {
    if (isElementaryContext()) {
      const common = constraintData.elementary.common;
      const cardLike = common.likes[result.cardNumber % common.likes.length];
      const otherLikes = common.likes.filter((item) => item !== cardLike);
      const cardDislike = common.dislikes[result.cardNumber % common.dislikes.length];
      const otherDislikes = common.dislikes.filter((item) => item !== cardDislike);
      const childPool = getElementaryReadingPool(readingPool, "personality", result.orientation);

      return [
        `好きなもの：${[cardLike, pickOne(otherLikes)].join("、")}。`,
        `嫌いなもの：${[cardDislike, pickOne(otherDislikes)].join("、")}。`,
        ...sample(childPool, count - 2)
      ];
    }

    const details = data.characterDetails[result.cardNumber][result.orientation];
    return [
      `好きなもの：${sample(details.likes, 2).join("、")}。`,
      `嫌いなもの：${sample(details.dislikes, 2).join("、")}。`,
      ...sample(readingPool, count - 2)
    ];
  }

  function generateRelationshipLines(result, readingPool, count) {
    if (isElementaryContext()) {
      const common = constraintData.elementary.common;
      const childPool = getElementaryReadingPool(readingPool, "relationships", result.orientation);
      return [
        `家族＆友人：${pickOne(common.connections[result.orientation])}`,
        ...sample(childPool, count - 1)
      ];
    }

    const details = data.characterDetails[result.cardNumber][result.orientation];
    return [
      `家族＆友人：${details.connections}`,
      ...sample(readingPool, count - 1)
    ];
  }

  function generateWoundLines(result, readingPool, count) {
    if (isElementaryContext()) {
      const common = constraintData.elementary.common;
      const childPool = getElementaryReadingPool(readingPool, "wounds", result.orientation);
      const rawContradiction = findContradictionLine();
      const adaptedContradiction = adaptElementaryLine(rawContradiction);
      const contradiction = isElementaryAppropriate(adaptedContradiction, common.excludedTerms)
        ? adaptedContradiction
        : pickOne(common.fallbackReadings.wounds[result.orientation]);

      return [
        `負傷・健康：${pickOne(common.injuries[result.orientation])}`,
        ...sample(childPool.filter((line) => line !== contradiction), count - 2),
        contradiction
      ];
    }

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
    nameState = createNameResult();
    spreadVersion += 1;
    generateAllLines();
  }

  function setText(root, selector, value) {
    root.querySelector(selector).textContent = value;
  }

  function renderSpread() {
    renderConstraintSummary();
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
    renderNameArcana();
    updateToolbar();
  }

  function replaceNameCandidates(list, names) {
    list.replaceChildren();
    names.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      list.append(item);
    });
  }

  function renderNameArcana() {
    if (!nameState) return;

    const card = getMinorCard(nameState.cardId);
    const reading = card[nameState.orientation];
    const isUpright = nameState.orientation === "upright";
    const lockIcon = elements.nameLockButton.querySelector(".lock-button__icon");
    const lockLabel = elements.nameLockButton.querySelector(".lock-button__label");

    elements.nameArcana.classList.toggle("is-locked", nameState.locked);
    elements.nameArcana.classList.toggle("is-revealed", nameState.revealed);
    elements.nameArcana.classList.toggle("is-reversed", !isUpright);
    elements.nameTarotNumber.textContent = `MINOR · ${card.rank.toUpperCase()}`;
    elements.nameTarotSymbol.textContent = card.symbol;
    elements.nameTarotNameJa.textContent = card.nameJa;
    elements.nameTarotNameEn.textContent = card.nameEn;
    elements.nameTarotOrientation.textContent = isUpright ? "正位置" : "逆位置";
    elements.nameTarotTags.textContent = reading.tags.join("・");
    elements.nameDirection.textContent = reading.direction;
    elements.nameMotifs.textContent = reading.motifs.join("・");
    replaceNameCandidates(elements.japaneseNameCandidates, nameState.japaneseNames);
    replaceNameCandidates(elements.internationalNameCandidates, nameState.internationalNames);

    elements.nameTarotButton.setAttribute(
      "aria-label",
      nameState.revealed
        ? `名前の小アルカナ：${card.nameJa}、${isUpright ? "正位置" : "逆位置"}`
        : "名前の小アルカナをめくる"
    );
    elements.nameTarotButton.setAttribute("aria-expanded", String(nameState.revealed));
    elements.nameLockButton.setAttribute("aria-pressed", String(nameState.locked));
    elements.nameLockButton.setAttribute(
      "aria-label",
      `名前の小アルカナを${nameState.locked ? "固定解除" : "固定"}`
    );
    lockIcon.textContent = nameState.locked ? "◆" : "◇";
    lockLabel.textContent = nameState.locked ? "固定中" : "固定";
    elements.rerollNameButton.disabled = nameState.locked;
    elements.nameInterpretation.hidden = !nameState.revealed;
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

  function revealNameArcana() {
    if (!nameState || nameState.revealed) return;

    nameState.revealed = true;
    elements.nameArcana.classList.add("is-revealed");
    const card = getMinorCard(nameState.cardId);
    elements.nameTarotButton.setAttribute("aria-expanded", "true");
    elements.nameTarotButton.setAttribute(
      "aria-label",
      `名前の小アルカナ：${card.nameJa}、${orientationLabel(nameState)}`
    );
    window.setTimeout(() => {
      elements.nameInterpretation.hidden = false;
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

  function toggleNameLock() {
    if (!nameState) return;
    nameState.locked = !nameState.locked;
    renderNameArcana();
    updateToolbar();
    showToast(nameState.locked ? "名前の小アルカナを固定しました" : "名前の小アルカナの固定を解除しました");
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

  function rerollNameArcana() {
    if (!nameState || nameState.locked) return;
    const previousCardId = nameState.cardId;
    nameState = createNameResult(previousCardId);
    spreadVersion += 1;
    renderNameArcana();
    updateToolbar();
    showToast("名前の小アルカナを再抽選しました");
  }

  function rerollAll() {
    makeFreshSpread();
    renderSpread();
    showToast("6枚すべてを再抽選しました（固定は解除されました）");
  }

  function rerollUnlocked() {
    const unlockedIndexes = spreadState
      .map((result, index) => result.locked ? -1 : index)
      .filter((index) => index >= 0);
    const shouldRerollName = Boolean(nameState && !nameState.locked);

    if (unlockedIndexes.length === 0 && !shouldRerollName) {
      showToast("すべて固定されています。固定を解除してから再抽選してください");
      return;
    }

    const lockedNumbers = spreadState
      .filter((result) => result.locked)
      .map((result) => result.cardNumber);
    const oldUnlockedNumbers = unlockedIndexes.map((index) => spreadState[index].cardNumber);
    const excluded = [...lockedNumbers, ...oldUnlockedNumbers];
    let newCardNumbers;

    if (unlockedIndexes.length > 0) {
      try {
        newCardNumbers = drawCardNumbers(unlockedIndexes.length, excluded);
      } catch (_error) {
        newCardNumbers = drawCardNumbers(unlockedIndexes.length, lockedNumbers);
      }
    }

    unlockedIndexes.forEach((stateIndex, drawIndex) => {
      const categoryId = spreadState[stateIndex].categoryId;
      spreadState[stateIndex] = createResult(categoryId, newCardNumbers[drawIndex]);
    });
    spreadVersion += 1;
    unlockedIndexes.forEach((stateIndex) => {
      spreadState[stateIndex].lines = generateLines(spreadState[stateIndex]);
    });
    if (shouldRerollName) {
      nameState = createNameResult(nameState.cardId);
    }
    renderSpread();
    const rerolledCount = unlockedIndexes.length + (shouldRerollName ? 1 : 0);
    showToast(`未固定の${rerolledCount}枚を再抽選しました`);
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

    if (nameState && !nameState.revealed) {
      newlyRevealed += 1;
      window.setTimeout(() => {
        if (spreadVersion === versionAtStart) revealNameArcana();
      }, (newlyRevealed - 1) * 90);
    }

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
    const constraintEntries = getConstraintEntries();
    const constraintSection = constraintEntries.length > 0
      ? [
        "",
        "【決まっている設定】",
        ...constraintEntries.map((entry) => `・${entry.label}：${entry.value}`)
      ]
      : [];
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
    const nameCard = getMinorCard(nameState.cardId);
    const nameReading = nameCard[nameState.orientation];
    const nameSection = [
      "",
      "【VI. 名前の小アルカナ】",
      `${nameCard.nameJa}（${nameCard.nameEn}）／${orientationLabel(nameState)}`,
      `意味：${nameReading.tags.join("・")}`,
      `名前の方向性：${nameReading.direction}`,
      `日本名の例：${nameState.japaneseNames.join("／")}`,
      `海外名の例：${nameState.internationalNames.join("／")}`,
      `モチーフ：${nameReading.motifs.join("・")}`
    ].join("\n");
    const footer = [
      "",
      "この結果はキャラクター作成のヒントです。気に入らない設定は自由に無視・変更してください。"
    ];
    return [...header, ...constraintSection, ...sections, nameSection, ...footer].join("\n");
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
    const hasNameResult = Boolean(nameState);
    const allLocked = hasResults
      && hasNameResult
      && spreadState.every((result) => result.locked)
      && nameState.locked;
    const allRevealed = hasResults
      && hasNameResult
      && spreadState.every((result) => result.revealed)
      && nameState.revealed;
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
    activeConstraints = readConstraintInputs();
    makeFreshSpread();
    renderSpread();
    elements.reading.hidden = false;
    elements.drawButton.textContent = "新しいキャラクターをつくる";
    window.requestAnimationFrame(() => {
      elements.reading.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  elements.drawButton.addEventListener("click", beginReading);
  elements.rerollAllButton.addEventListener("click", rerollAll);
  elements.rerollUnlockedButton.addEventListener("click", rerollUnlocked);
  elements.revealAllButton.addEventListener("click", revealAll);
  elements.copyButton.addEventListener("click", copyResults);
  elements.nameTarotButton.addEventListener("click", revealNameArcana);
  elements.nameLockButton.addEventListener("click", toggleNameLock);
  elements.rerollNameButton.addEventListener("click", rerollNameArcana);
  elements.clearConstraintsButton.addEventListener("click", clearConstraintInputs);
  constraintFields.forEach((field) => {
    field.element.addEventListener("input", updateConstraintCount);
  });
  updateConstraintCount();
  updateToolbar();
})();
