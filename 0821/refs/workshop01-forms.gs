/**
 * AI Agent 工作坊 (一) — 8/3 場 前後測問卷自動建立腳本
 * ================================================
 * 使用方式：
 *   1. 前往 https://script.google.com → 點「新增專案」
 *   2. 刪除預設內容，貼入本程式碼
 *   3. 點上方「執行」→ 選擇函式 createWorkshopForms
 *   4. 首次執行需授權 — 選「進階」→「前往 (不安全)」→「允許」
 *   5. 執行完成後點「查看 > 記錄」(Ctrl+Enter) 取得表單連結與試算表連結
 * ================================================
 * 產出：
 *   · 8/3 前測 Google Form（工作坊開始時發放 QR Code）
 *   · 8/3 後測 Google Form（工作坊結束時發放 QR Code）
 *   · Google 試算表，含「前測」「後測」回應工作表，
 *     以及「配對分析」「摘要統計」「下載連結」三個分析工作表。
 * ================================================
 * 本檔為 07/02、07/09 場次腳本 (google-apps-script-by-session/) 的獨立複製版，
 * 僅新增 8/3 這一場次，不會動到前兩場已收集的表單與試算表資料。
 * 題目文字與 07/02、07/09 場次完全相同，前後測皆可跨場次合併比較。
 */

var SESSION = { key: '0803', label: '08/03 (一)', title: '8/3 場' };

function createWorkshopForms() {
  var ss = SpreadsheetApp.create('AI Agent 工作坊 (一) 前後測資料 2026 - 8/3 場');
  var ssId = ss.getId();

  var preForm = buildPreForm(SESSION);
  linkFormToResponseSheet(preForm, ss, '前測');

  var postForm = buildPostForm(SESSION);
  linkFormToResponseSheet(postForm, ss, '後測');

  buildAnalysisSheet(ss);
  buildSummarySheet(ss);
  buildDownloadLinksSheet(ss);

  ['Sheet1', '工作表1'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) ss.deleteSheet(sheet);
  });

  DriveApp.getFileById(ssId)
    .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var msg = ['建立完成！', '', '試算表：', ss.getUrl(), ''];
  buildResultDownloadLinks(ss).forEach(function(link) {
    msg.push(link.label + '：');
    msg.push(link.url);
  });
  msg.push('');
  msg.push(SESSION.label + ' 前測表單：');
  msg.push(preForm.getPublishedUrl());
  msg.push(SESSION.label + ' 前測編輯連結：');
  msg.push('https://docs.google.com/forms/d/' + preForm.getId() + '/edit');
  msg.push('');
  msg.push(SESSION.label + ' 後測表單：');
  msg.push(postForm.getPublishedUrl());
  msg.push(SESSION.label + ' 後測編輯連結：');
  msg.push('https://docs.google.com/forms/d/' + postForm.getId() + '/edit');

  Logger.log(msg.join('\n'));

  try {
    SpreadsheetApp.openById(ssId).toast('完成！請查看執行記錄取得表單與試算表連結。', '建立成功', 30);
  } catch (e) {}
}

function buildResultDownloadLinks(ss) {
  var ssId = ss.getId();
  var baseUrl = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?';
  var links = [
    {
      label: 'XLSX',
      url: baseUrl + 'format=xlsx'
    }
  ];

  ['摘要統計', '配對分析'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    links.push({
      label: 'CSV ' + sheetName,
      url: baseUrl + 'format=csv&gid=' + sheet.getSheetId()
    });
  });

  return links;
}

function buildDownloadLinksSheet(ss) {
  var sheet = ss.insertSheet('下載連結', 0);
  var links = buildResultDownloadLinks(ss);

  sheet.getRange(1, 1, 1, 2)
    .setValues([['項目', '下載']])
    .setBackground('#1a3a5c')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  var rows = links.map(function(link) {
    return [
      link.label,
      '=HYPERLINK("' + link.url + '","' + link.label + '")'
    ];
  });

  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 160);
}

function linkFormToResponseSheet(form, ss, responseSheetName) {
  var before = getSheetNameMap(ss);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();

  for (var i = 0; i < 10; i++) {
    Utilities.sleep(1000);
    var sheets = ss.getSheets();
    for (var j = 0; j < sheets.length; j++) {
      var sheet = sheets[j];
      var name = sheet.getName();
      var isResponseSheet = name.indexOf('Form Responses') === 0 || name.indexOf('表單回應') === 0;
      if (!before[name] && isResponseSheet) {
        sheet.setName(responseSheetName);
        return sheet;
      }
    }
  }

  throw new Error('找不到新建立的表單回應工作表：' + responseSheetName);
}

function getSheetNameMap(ss) {
  var result = {};
  ss.getSheets().forEach(function(sheet) {
    result[sheet.getName()] = true;
  });
  return result;
}

function pairingIdHelpText() {
  return [
    '這是匿名配對代碼，只用於把同一人的前測與後測合併分析，不用於身份辨識。',
    '建議填生日月日 4 碼，例如 7 月 15 日填 0715。',
    '也可以填自己記得的 4-6 位魔術數字；重點是前測與後測必須完全相同。'
  ].join('\n');
}

function addPairingIdItem(form) {
  form.addTextItem()
    .setTitle('配對代碼（匿名，前後測需相同）')
    .setHelpText(pairingIdHelpText())
    .setRequired(true);
}

function configurePublicFormAccess(form) {
  form.setCollectEmail(false);
  form.setRequireLogin(false);
  form.setLimitOneResponsePerUser(false);
  form.setAcceptingResponses(true);

  DriveApp.getFileById(form.getId())
    .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
}

function addSelfEfficacyItems(form, timing) {
  form.addSectionHeaderItem()
    .setTitle('自我效能評估（工作坊' + timing + '）')
    .setHelpText(
      '請依據您參加工作坊「' + timing + '」的認知與信心程度作答。\n' +
      '1 = 完全不同意　5 = 完全同意'
    );

  getSelfEfficacyItems().forEach(function(item) {
    form.addScaleItem()
      .setTitle(item.title)
      .setHelpText(item.help)
      .setBounds(1, 5)
      .setLabels('完全不同意', '完全同意')
      .setRequired(true);
  });
}

function getSelfEfficacyItems() {
  return [
    {
      title: 'SE-1 環境掌控感',
      help: '我能在自己的電腦上自行安裝並維護 AI Agent 執行環境。'
    },
    {
      title: 'SE-2 工具辨別力',
      help: '我能區分「聊天 AI」、「AI Agent」與「Local LLM」各自的適用時機。'
    },
    {
      title: 'SE-3 工作流程思維',
      help: '我能將重複性教學庶務規劃成 AI Agent 可自動執行的工作流程。'
    },
    {
      title: 'SE-4 隱私判斷力',
      help: '我能判斷哪些情境應使用 Local LLM 而非雲端服務來保護資料隱私。'
    },
    {
      title: 'SE-5 技術焦慮（反向計分）',
      help: '我對「非資電背景教師能否自行建置 AI 教學工具」感到技術焦慮。\n反向計分：高分 = 焦慮高，分析時 Δ < 0 代表焦慮降低。'
    }
  ];
}

function buildPreForm(session) {
  var form = FormApp.create('AI Agent 工作坊 (一) - ' + session.title + '前測問卷');
  configurePublicFormAccess(form);
  form.setDescription(
    '請在 ' + session.label + ' 工作坊開始前填寫，約需 2 分鐘。\n' +
    '本問卷僅用於教學成效分析，不作個人識別用途。\n' +
    '請記住您的配對代碼，後測需填寫完全相同的代碼。'
  );
  form.setProgressBar(false);
  form.setShuffleQuestions(false);
  form.setConfirmationMessage('感謝您完成 ' + session.label + ' 前測！工作坊結束後請記得填寫後測問卷。');

  form.addSectionHeaderItem()
    .setTitle('配對代碼')
    .setHelpText('場次已固定為 ' + session.label + '，不需要另外選擇。');
  addPairingIdItem(form);

  form.addSectionHeaderItem()
    .setTitle('基本資料')
    .setHelpText('用於分組分析，不作個人識別。');

  form.addListItem()
    .setTitle('P0a - 您任教的學科領域')
    .setChoiceValues(['人文社科', '商管', '設計藝術', '醫護照護', '理工（非資電）', '其他'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('P0b - 您的電腦作業系統')
    .setHelpText('影響工作坊模組一的環境建置路徑。')
    .setChoiceValues(['macOS', 'Windows', '其他'])
    .setRequired(true);

  form.addSectionHeaderItem()
    .setTitle('AI 使用經驗與教學痛點');

  form.addMultipleChoiceItem()
    .setTitle('P1 - 您目前使用生成式 AI 工具的頻率')
    .setChoiceValues([
      '幾乎每天（備課、教材撰寫、行政等例行工作）',
      '每週數次（準備當週課程教材時）',
      '每月數次（僅特定任務，如期末命題）',
      '很少（他人推薦時偶爾嘗試）',
      '從未使用過'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('P2 - 工作坊結束後，您最希望 AI Agent 能協助您解決哪一個問題？')
    .setChoiceValues([
      '自動設計隨堂測驗題目（依課程動態進度生成）',
      '批改作業並給予個人化即時回饋',
      '定期爬取最新資訊來更新教材',
      '整合資料生成教案或講義草稿',
      '解答學生課後各式疑問'
    ])
    .setRequired(true);

  addSelfEfficacyItems(form, '前');
  return form;
}

function buildPostForm(session) {
  var form = FormApp.create('AI Agent 工作坊 (一) - ' + session.title + '後測問卷');
  configurePublicFormAccess(form);
  form.setDescription(
    '請在 ' + session.label + ' 工作坊結束後立即填寫，約需 2.5 分鐘。\n' +
    'Q1 題目文字與前測相同，以便計算工作坊前後的變化量。\n' +
    '配對代碼請填寫與前測完全相同的代碼。'
  );
  form.setProgressBar(false);
  form.setShuffleQuestions(false);
  form.setConfirmationMessage('感謝您完成 ' + session.label + ' 後測！您的回饋將有助於改善後續工作坊品質。');

  form.addSectionHeaderItem()
    .setTitle('配對代碼')
    .setHelpText('場次已固定為 ' + session.label + '，不需要另外選擇。');
  addPairingIdItem(form);

  addSelfEfficacyItems(form, '後');

  form.addSectionHeaderItem()
    .setTitle('模組評估與障礙確認');

  form.addMultipleChoiceItem()
    .setTitle('Q2 - 今天哪個模組對您的幫助最大？')
    .setChoiceValues([
      '模組一：環境建置與驗證',
      '模組二：三種 AI 的差異體驗（聊天 AI / Agent / Local LLM）',
      '模組三：網頁瀏覽與資料擷取',
      '模組四：資訊整理與教學素材產生',
      '模組五：Local LLM 與資料隱私'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q3 - 工作坊後，您仍然最擔心的是哪一項？')
    .setChoiceValues([
      '課後無法自行維護 AI 工作環境',
      '資料隱私與外洩風險',
      '學生過度依賴 AI 代筆',
      '不知如何與自身學科具體結合',
      '沒有時間調整現有教學大綱',
      '已無明顯擔憂'
    ])
    .setRequired(true);

  form.addSectionHeaderItem()
    .setTitle('整體滿意度與開放回饋');

  form.addScaleItem()
    .setTitle('Q4a - 這場工作坊對您教學實務的幫助程度')
    .setBounds(1, 5)
    .setLabels('幾乎無幫助', '非常有幫助')
    .setRequired(true);

  form.addScaleItem()
    .setTitle('Q4b - 您有多大可能向同校 / 同院系同事推薦這場工作坊？（NPS）')
    .setHelpText('0 = 完全不會推薦　10 = 極力推薦')
    .setBounds(0, 10)
    .setLabels('完全不推薦', '極力推薦')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Q5 - 工作坊中讓您印象最深刻，或讓您想法改變最大的一件事是什麼？')
    .setHelpText('可不填。一句話即可，無需長篇。')
    .setRequired(false);

  return form;
}

/**
 * 配對分析工作表
 * 前測欄位：A=Timestamp B=配對代碼 C=學科 D=系統 E=AI頻率 F=教學痛點
 *           G-K=SE1-5（前）
 * 後測欄位：A=Timestamp B=配對代碼 C-G=SE1-5（後）
 *           H=Q2模組 I=Q3障礙 J=Q4a K=Q4b(NPS) L=Q5
 */
function buildAnalysisSheet(ss) {
  var sheet = ss.insertSheet('配對分析');

  var headers = [
    '配對代碼', '場次', '學科', '系統', 'AI頻率', '教學痛點(前)',
    'PRE_SE1', 'PRE_SE2', 'PRE_SE3', 'PRE_SE4', 'PRE_SE5',
    'POST_SE1', 'POST_SE2', 'POST_SE3', 'POST_SE4', 'POST_SE5',
    'Δ_SE1', 'Δ_SE2', 'Δ_SE3', 'Δ_SE4', 'Δ_SE5(反向)',
    '最佳模組(後)', '仍擔心(後)', '滿意度(Q4a)', 'NPS(Q4b)', '收穫文字(Q5)'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setWrap(false);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 6).setBackground('#374151').setFontColor('#f9fafb');
  sheet.getRange(1, 7, 1, 5).setBackground('#1e3a6e').setFontColor('#bfdbfe');
  sheet.getRange(1, 12, 1, 5).setBackground('#14532d').setFontColor('#bbf7d0');
  sheet.getRange(1, 17, 1, 5).setBackground('#7c2d12').setFontColor('#fed7aa');
  sheet.getRange(1, 22, 1, 5).setBackground('#374151').setFontColor('#f9fafb');

  var preMap = {
    'A2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!B2:B))',
    'B2': '=ARRAYFORMULA(IF(前測!B2:B="","","' + SESSION.label + '"))',
    'C2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!C2:C))',
    'D2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!D2:D))',
    'E2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!E2:E))',
    'F2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!F2:F))',
    'G2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!G2:G))',
    'H2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!H2:H))',
    'I2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!I2:I))',
    'J2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!J2:J))',
    'K2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!K2:K))'
  };

  var postMap = {
    'L2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!C2:C},2,0),""))',
    'M2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!D2:D},2,0),""))',
    'N2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!E2:E},2,0),""))',
    'O2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!F2:F},2,0),""))',
    'P2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!G2:G},2,0),""))',
    'V2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!H2:H},2,0),""))',
    'W2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!I2:I},2,0),""))',
    'X2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!J2:J},2,0),""))',
    'Y2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!K2:K},2,0),""))',
    'Z2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!L2:L},2,0),""))'
  };

  var deltaMap = {
    'Q2': '=ARRAYFORMULA(IF((G2:G="")+(L2:L=""),"",VALUE(L2:L)-VALUE(G2:G)))',
    'R2': '=ARRAYFORMULA(IF((H2:H="")+(M2:M=""),"",VALUE(M2:M)-VALUE(H2:H)))',
    'S2': '=ARRAYFORMULA(IF((I2:I="")+(N2:N=""),"",VALUE(N2:N)-VALUE(I2:I)))',
    'T2': '=ARRAYFORMULA(IF((J2:J="")+(O2:O=""),"",VALUE(O2:O)-VALUE(J2:J)))',
    'U2': '=ARRAYFORMULA(IF((K2:K="")+(P2:P=""),"",VALUE(P2:P)-VALUE(K2:K)))'
  };

  var allFormulas = Object.assign({}, preMap, postMap, deltaMap);
  Object.keys(allFormulas).forEach(function(cell) {
    sheet.getRange(cell).setFormula(allFormulas[cell]);
  });

  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 160);
  sheet.setColumnWidth(6, 180);
  for (var c = 7; c <= 21; c++) sheet.setColumnWidth(c, 72);
  sheet.setColumnWidth(22, 220);
  sheet.setColumnWidth(23, 170);
  sheet.setColumnWidth(24, 72);
  sheet.setColumnWidth(25, 60);
  sheet.setColumnWidth(26, 280);

  var deltaRange = sheet.getRange('Q2:T1000');
  var deltaRevRange = sheet.getRange('U2:U1000');
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#dcfce7').setFontColor('#166534').setRanges([deltaRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground('#fee2e2').setFontColor('#991b1b').setRanges([deltaRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground('#dcfce7').setFontColor('#166534').setRanges([deltaRevRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#fee2e2').setFontColor('#991b1b').setRanges([deltaRevRange]).build()
  ]);
}

function buildSummarySheet(ss) {
  var sheet = ss.insertSheet('摘要統計');

  sheet.getRange(1, 1, 1, 2)
    .setValues([['指標', SESSION.label]])
    .setBackground('#1a3a5c').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);

  var rows = [
    ['-- 回應人數 --', ''],
    ['前測回應', '=COUNTIF(前測!B2:B,"<>")'],
    ['後測回應', '=COUNTIF(後測!B2:B,"<>")'],
    ['配對完成（前+後）', '=COUNTIF(配對分析!L2:L,"<>")'],
    ['', ''],

    ['-- PRE 平均自我效能 --', ''],
    ['SE-1 環境掌控感（前）', '=IFERROR(AVERAGE(前測!G2:G),"")'],
    ['SE-2 工具辨別力（前）', '=IFERROR(AVERAGE(前測!H2:H),"")'],
    ['SE-3 工作流程（前）', '=IFERROR(AVERAGE(前測!I2:I),"")'],
    ['SE-4 隱私判斷（前）', '=IFERROR(AVERAGE(前測!J2:J),"")'],
    ['SE-5 技術焦慮（前）', '=IFERROR(AVERAGE(前測!K2:K),"")'],
    ['', ''],

    ['-- POST 平均自我效能 --', ''],
    ['SE-1 環境掌控感（後）', '=IFERROR(AVERAGE(後測!C2:C),"")'],
    ['SE-2 工具辨別力（後）', '=IFERROR(AVERAGE(後測!D2:D),"")'],
    ['SE-3 工作流程（後）', '=IFERROR(AVERAGE(後測!E2:E),"")'],
    ['SE-4 隱私判斷（後）', '=IFERROR(AVERAGE(後測!F2:F),"")'],
    ['SE-5 技術焦慮（後）', '=IFERROR(AVERAGE(後測!G2:G),"")'],
    ['', ''],

    ['-- 平均 Δ（POST - PRE，僅配對成功者）--', ''],
    ['Δ SE-1 環境掌控感', '=IFERROR(AVERAGE(配對分析!Q2:Q),"")'],
    ['Δ SE-2 工具辨別力', '=IFERROR(AVERAGE(配對分析!R2:R),"")'],
    ['Δ SE-3 工作流程', '=IFERROR(AVERAGE(配對分析!S2:S),"")'],
    ['Δ SE-4 隱私判斷', '=IFERROR(AVERAGE(配對分析!T2:T),"")'],
    ['Δ SE-5 焦慮下降（反向）', '=IFERROR(AVERAGE(配對分析!U2:U),"")'],
    ['', ''],

    ['-- 後測質性摘要 --', ''],
    ['平均滿意度 (Q4a/5)', '=IFERROR(AVERAGE(後測!J2:J),"")'],
    ['平均 NPS 分數 (Q4b/10)', '=IFERROR(AVERAGE(後測!K2:K),"")'],
    ['NPS 推薦者 %（>=9）', '=IFERROR(COUNTIF(後測!K2:K,">="&9)/COUNTIF(後測!K2:K,"<>"),"")'],
    ['NPS 批評者 %（<=6）', '=IFERROR(COUNTIF(後測!K2:K,"<="&6)/COUNTIF(後測!K2:K,"<>"),"")'],
    ['最多人選的最佳模組', modeTextFormula('後測!H2:H')],
    ['最多人仍擔心的障礙', modeTextFormula('後測!I2:I')]
  ];

  sheet.getRange(2, 1, rows.length, 2).setValues(rows);

  [2, 7, 14, 21, 28].forEach(function(row) {
    sheet.getRange(row, 1, 1, 2).setBackground('#f0f4f8').setFontWeight('bold').setFontColor('#374151');
  });

  sheet.getRange(3, 2, 3, 1).setNumberFormat('0');
  sheet.getRange(8, 2, 5, 1).setNumberFormat('0.00');
  sheet.getRange(15, 2, 5, 1).setNumberFormat('0.00');
  sheet.getRange(22, 2, 5, 1).setNumberFormat('0.00');
  sheet.getRange(29, 2, 2, 1).setNumberFormat('0.00');
  sheet.getRange(31, 2, 2, 1).setNumberFormat('0.0%');

  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidth(2, 150);
}

function modeTextFormula(rangeA1) {
  return '=IFERROR(INDEX(QUERY({' + rangeA1 + '},"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label count(Col1) \'\'",0),1,1),"")';
}
