/**
 * AI Agent 助教技能培訓工作坊 (0813) - 前後測問卷自動建立腳本
 * ==================================================
 * 依據 refs/AI-Agent-助教技能培訓工作坊-執行方案.md 的實際課程內容設計。
 * 產出：
 *   - 8/13 前測 Google Form
 *   - 8/13 後測 Google Form
 *   - Google 試算表，含 2 個回應工作表與 3 個分析／匯出工作表
 *
 * 與教師工作坊腳本（AI Agent 工作坊(一)）的差異：
 *   - 單一場次，移除跨場次堆疊（QUERY 陣列合併）邏輯。
 *   - 前後測配對改以「Email（自填，非驗證）」為主要比對鍵，
 *     搭配原本的配對代碼作為備援／人工核對用途，降低自選代碼碰撞風險。
 *     注意：RESPONDER_INPUT 的 Email 未經 Google 帳號驗證，若前後測輸入不一致
 *     仍會配對失敗；可提醒填答者兩次使用同一 Email。
 *   - 自我效能題組改寫為「助教技術支援」情境：環境建置、Chatbot/Agent 辨識、
 *     專案檔案管理、測試與問題回報、技術焦慮。
 */

var SESSION = { key: '0813', label: '08/13 (四) 下午場', title: '8/13 助教技能培訓工作坊' };
var RESPONSE_LIMIT = 1000;

function createTAWorkshopForms() {
  var ss = SpreadsheetApp.create('AI Agent 助教技能培訓工作坊 前後測資料 2026 - 08/13');
  var ssId = ss.getId();

  var preForm = buildPreForm();
  linkFormToResponseSheet(preForm, ss, '前測');

  var postForm = buildPostForm();
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

  var msg = ['建立完成！', '', '結果：', ss.getUrl(), ''];
  buildResultDownloadLinks(ss).forEach(function(link) {
    msg.push(link.label + '：');
    msg.push(link.url);
  });
  msg.push('');
  msg.push('前測表單：');
  msg.push(preForm.getPublishedUrl());
  msg.push('前測編輯連結：');
  msg.push('https://docs.google.com/forms/d/' + preForm.getId() + '/edit');
  msg.push('');
  msg.push('後測表單：');
  msg.push(postForm.getPublishedUrl());
  msg.push('後測編輯連結：');
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
    { label: 'XLSX', url: baseUrl + 'format=xlsx' }
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
    return [link.label, '=HYPERLINK("' + link.url + '","' + link.label + '")'];
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
    '這是備援用配對代碼；系統主要以您填寫的 Email 自動比對前後測，此欄位供人工核對使用。',
    '建議填生日月日 4 碼，例如 7 月 15 日填 0715。',
    '重點是前測與後測必須填寫完全相同的代碼。'
  ].join('\n');
}

function addPairingIdItem(form) {
  form.addTextItem()
    .setTitle('配對代碼（備援比對用，前後測需相同）')
    .setHelpText(pairingIdHelpText())
    .setRequired(true);
}

function configurePublicFormAccess(form) {
  form.setEmailCollectionType(FormApp.EmailCollectionType.RESPONDER_INPUT);
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
      '請依據您協助教師或同仁排除 AI Agent 技術問題的認知與信心程度作答。\n' +
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
      title: 'SE-1 環境建置能力',
      help: '我能安裝、開啟並初步驗證 VS Code、Python、Node.js 等本機工具，並排除常見的登入、權限或版本問題。'
    },
    {
      title: 'SE-2 Chatbot／Agent 辨識力',
      help: '我能分辨 Chatbot 與 AI Agent 的差異，判斷哪些工作可請 AI 協助、哪些結果仍須人員確認。'
    },
    {
      title: 'SE-3 專案與檔案管理',
      help: '我能建立清楚的專案資料夾，分辨來源資料、程式檔、產出檔與執行位置，並以完整路徑說明問題所在。'
    },
    {
      title: 'SE-4 測試與問題回報',
      help: '我能以「預期結果、實際結果、操作步驟、錯誤訊息」記錄問題，並向 AI Agent 提出可驗證的修正需求。'
    },
    {
      title: 'SE-5 技術焦慮（反向計分）',
      help: '我對「協助教師或同仁排除 AI Agent／vibe coding 相關技術問題」感到技術焦慮。\n反向計分：高分 = 焦慮高，分析時 Δ < 0 代表焦慮降低。'
    }
  ];
}

function buildPreForm() {
  var form = FormApp.create('AI Agent 助教技能培訓工作坊 - ' + SESSION.title + '前測問卷');
  configurePublicFormAccess(form);
  form.setDescription(
    '請在 ' + SESSION.label + ' 工作坊開始前填寫，約需 2 分鐘。\n' +
    '本問卷僅用於培訓成效分析，Email 僅作為前後測配對比對用途，不會另作他用。\n' +
    '請記住您填寫的配對代碼，後測需填寫完全相同的代碼與 Email。'
  );
  form.setProgressBar(false);
  form.setShuffleQuestions(false);
  form.setConfirmationMessage('感謝您完成前測！工作坊結束後請記得填寫後測問卷。');

  form.addSectionHeaderItem()
    .setTitle('配對代碼')
    .setHelpText('場次已固定為 ' + SESSION.label + '，不需要另外選擇。');
  addPairingIdItem(form);

  form.addSectionHeaderItem()
    .setTitle('基本資料')
    .setHelpText('用於分組分析，不作個人識別。');

  form.addListItem()
    .setTitle('P0a - 您目前的角色')
    .setChoiceValues(['助教（教師或單位推薦）', '行政／辦事同仁', '其他'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('P0b - 您的電腦作業系統')
    .setHelpText('影響 VS Code／Python／Node.js 安裝驗證單元的操作路徑。')
    .setChoiceValues(['macOS', 'Windows', '其他'])
    .setRequired(true);

  form.addSectionHeaderItem()
    .setTitle('AI 使用經驗與支援工作痛點');

  form.addMultipleChoiceItem()
    .setTitle('P1 - 您目前使用生成式 AI 工具的頻率')
    .setChoiceValues([
      '幾乎每天（工作或學習中例行使用）',
      '每週數次',
      '每月數次（僅特定任務）',
      '很少（他人推薦時偶爾嘗試）',
      '從未使用過'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('P2 - 工作坊結束後，您最希望能協助處理哪一類支援工作？')
    .setChoiceValues([
      '協助安裝與驗證 VS Code、Python、Node.js 等本機環境',
      '協助建立專案資料夾與辨識檔案位置',
      '協助使用 vibe coding 產生簡易網頁工具',
      '協助測試工具並向 AI Agent 提出修正需求',
      '判斷問題該自行處理或升級交由資訊單位／教師處理'
    ])
    .setRequired(true);

  addSelfEfficacyItems(form, '前');
  return form;
}

function buildPostForm() {
  var form = FormApp.create('AI Agent 助教技能培訓工作坊 - ' + SESSION.title + '後測問卷');
  configurePublicFormAccess(form);
  form.setDescription(
    '請在 ' + SESSION.label + ' 工作坊結束後立即填寫，約需 2.5 分鐘。\n' +
    'SE 題目文字與前測相同，以便計算工作坊前後的變化量。\n' +
    '配對代碼與 Email 請填寫與前測完全相同的內容。'
  );
  form.setProgressBar(false);
  form.setShuffleQuestions(false);
  form.setConfirmationMessage('感謝您完成後測！您的回饋將有助於改善後續培訓品質。');

  form.addSectionHeaderItem()
    .setTitle('配對代碼')
    .setHelpText('場次已固定為 ' + SESSION.label + '，不需要另外選擇。');
  addPairingIdItem(form);

  addSelfEfficacyItems(form, '後');

  form.addSectionHeaderItem()
    .setTitle('環節評估與障礙確認');

  form.addMultipleChoiceItem()
    .setTitle('Q2 - 今天哪個環節對您的支援工作最有幫助？')
    .setChoiceValues([
      '認識 AI Agent 與助教支援角色',
      '建置本機工具與專案資料夾（VS Code／Python／Node.js）',
      '開啟練習專案並確認執行流程',
      'vibe coding 實作：建立簡易網頁小工具',
      '測試工具、描述問題與請 AI 修正',
      '常見支援情境與問題處置流程'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q3 - 工作坊後，您仍然最擔心的是哪一項？')
    .setChoiceValues([
      '協助他人時無法自行排除環境安裝問題',
      '判斷問題該自行處理，還是升級交由資訊單位／教師',
      '向 AI Agent 描述問題不夠清楚，修正結果不如預期',
      '不確定資料安全與角色界線（哪些資料不能輸入 AI）',
      '沒有足夠時間熟悉這套工作方法',
      '已無明顯擔憂'
    ])
    .setRequired(true);

  form.addSectionHeaderItem()
    .setTitle('整體滿意度與開放回饋');

  form.addScaleItem()
    .setTitle('Q4a - 這場工作坊對您協助他人排除 AI Agent 技術問題的準備程度')
    .setBounds(1, 5)
    .setLabels('幾乎無幫助', '非常有幫助')
    .setRequired(true);

  form.addScaleItem()
    .setTitle('Q4b - 您有多大可能向其他助教／同仁推薦這場工作坊？（NPS）')
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

function buildAnalysisSheet(ss) {
  var sheet = ss.insertSheet('配對分析');
  var limit = RESPONSE_LIMIT;
  ensureRows(sheet, limit + 1);

  var headers = [
    '配對代碼', '角色', '系統', 'AI頻率', '支援痛點(前)',
    'PRE_SE1', 'PRE_SE2', 'PRE_SE3', 'PRE_SE4', 'PRE_SE5',
    'POST_SE1', 'POST_SE2', 'POST_SE3', 'POST_SE4', 'POST_SE5',
    'Δ_SE1', 'Δ_SE2', 'Δ_SE3', 'Δ_SE4', 'Δ_SE5(反向)',
    '最佳環節(後)', '仍擔心(後)', '滿意度(Q4a)', 'NPS(Q4b)', '收穫文字(Q5)'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setWrap(false);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 5).setBackground('#374151').setFontColor('#f9fafb');
  sheet.getRange(1, 6, 1, 5).setBackground('#1e3a6e').setFontColor('#bfdbfe');
  sheet.getRange(1, 11, 1, 5).setBackground('#14532d').setFontColor('#bbf7d0');
  sheet.getRange(1, 16, 1, 5).setBackground('#7c2d12').setFontColor('#fed7aa');
  sheet.getRange(1, 21, 1, 5).setBackground('#374151').setFontColor('#f9fafb');

  var formulas = {
    'A2': maskedFormula('前測', 'C', limit),
    'B2': maskedFormula('前測', 'D', limit),
    'C2': maskedFormula('前測', 'E', limit),
    'D2': maskedFormula('前測', 'F', limit),
    'E2': maskedFormula('前測', 'G', limit),
    'F2': maskedFormula('前測', 'H', limit),
    'G2': maskedFormula('前測', 'I', limit),
    'H2': maskedFormula('前測', 'J', limit),
    'I2': maskedFormula('前測', 'K', limit),
    'J2': maskedFormula('前測', 'L', limit),
    'K2': lookupFormula('D', limit),
    'L2': lookupFormula('E', limit),
    'M2': lookupFormula('F', limit),
    'N2': lookupFormula('G', limit),
    'O2': lookupFormula('H', limit),
    'U2': lookupFormula('I', limit),
    'V2': lookupFormula('J', limit),
    'W2': lookupFormula('K', limit),
    'X2': lookupFormula('L', limit),
    'Y2': lookupFormula('M', limit),
    'P2': deltaFormula('F', 'K', limit),
    'Q2': deltaFormula('G', 'L', limit),
    'R2': deltaFormula('H', 'M', limit),
    'S2': deltaFormula('I', 'N', limit),
    'T2': deltaFormula('J', 'O', limit)
  };

  Object.keys(formulas).forEach(function(cell) {
    sheet.getRange(cell).setFormula(formulas[cell]);
  });

  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 220);
  for (var c = 6; c <= 20; c++) sheet.setColumnWidth(c, 72);
  sheet.setColumnWidth(21, 240);
  sheet.setColumnWidth(22, 200);
  sheet.setColumnWidth(23, 72);
  sheet.setColumnWidth(24, 60);
  sheet.setColumnWidth(25, 280);

  var deltaRange = sheet.getRange('P2:S' + limit);
  var deltaRevRange = sheet.getRange('T2:T' + limit);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#dcfce7').setFontColor('#166534').setRanges([deltaRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground('#fee2e2').setFontColor('#991b1b').setRanges([deltaRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground('#dcfce7').setFontColor('#166534').setRanges([deltaRevRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#fee2e2').setFontColor('#991b1b').setRanges([deltaRevRange]).build()
  ]);
}

function maskedFormula(sheetName, col, limit) {
  return '=ARRAYFORMULA(IF(' + sheetName + '!$B$2:$B' + limit + '="","",' +
    sheetName + '!' + col + '2:' + col + limit + '))';
}

function lookupFormula(postCol, limit) {
  return '=ARRAYFORMULA(IF(前測!$B$2:$B' + limit + '="","",' +
    'IFERROR(VLOOKUP(前測!$B$2:$B' + limit + ',{後測!$B$2:$B' + limit + ',後測!' + postCol + '2:' + postCol + limit + '},2,0),"")))';
}

function deltaFormula(preCol, postCol, limit) {
  return '=ARRAYFORMULA(IF((' + preCol + '2:' + preCol + limit + '="")+(' + postCol + '2:' + postCol + limit + '=""),"",' +
    'VALUE(' + postCol + '2:' + postCol + limit + ')-VALUE(' + preCol + '2:' + preCol + limit + ')))';
}

function buildSummarySheet(ss) {
  var sheet = ss.insertSheet('摘要統計');

  sheet.getRange(1, 1, 1, 2)
    .setValues([['指標', '數值']])
    .setBackground('#1a3a5c').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);

  var rows = [
    ['-- 回應人數 --', ''],
    ['前測回應', '=COUNTIF(前測!B2:B,"<>")'],
    ['後測回應', '=COUNTIF(後測!B2:B,"<>")'],
    ['配對完成（前+後）', '=COUNTIF(配對分析!K2:K,">0")'],
    ['', ''],

    ['-- PRE 平均自我效能 --', ''],
    ['SE-1 環境建置能力（前）', '=IFERROR(AVERAGE(配對分析!F2:F),"")'],
    ['SE-2 Chatbot/Agent辨識力（前）', '=IFERROR(AVERAGE(配對分析!G2:G),"")'],
    ['SE-3 專案與檔案管理（前）', '=IFERROR(AVERAGE(配對分析!H2:H),"")'],
    ['SE-4 測試與問題回報（前）', '=IFERROR(AVERAGE(配對分析!I2:I),"")'],
    ['SE-5 技術焦慮（前）', '=IFERROR(AVERAGE(配對分析!J2:J),"")'],
    ['', ''],

    ['-- POST 平均自我效能 --', ''],
    ['SE-1 環境建置能力（後）', '=IFERROR(AVERAGE(配對分析!K2:K),"")'],
    ['SE-2 Chatbot/Agent辨識力（後）', '=IFERROR(AVERAGE(配對分析!L2:L),"")'],
    ['SE-3 專案與檔案管理（後）', '=IFERROR(AVERAGE(配對分析!M2:M),"")'],
    ['SE-4 測試與問題回報（後）', '=IFERROR(AVERAGE(配對分析!N2:N),"")'],
    ['SE-5 技術焦慮（後）', '=IFERROR(AVERAGE(配對分析!O2:O),"")'],
    ['', ''],

    ['-- 平均 Δ（POST - PRE，僅配對成功者）--', ''],
    ['Δ SE-1 環境建置能力', '=IFERROR(AVERAGE(配對分析!P2:P),"")'],
    ['Δ SE-2 Chatbot/Agent辨識力', '=IFERROR(AVERAGE(配對分析!Q2:Q),"")'],
    ['Δ SE-3 專案與檔案管理', '=IFERROR(AVERAGE(配對分析!R2:R),"")'],
    ['Δ SE-4 測試與問題回報', '=IFERROR(AVERAGE(配對分析!S2:S),"")'],
    ['Δ SE-5 焦慮下降（反向）', '=IFERROR(AVERAGE(配對分析!T2:T),"")'],
    ['', ''],

    ['-- 後測質性摘要 --', ''],
    ['平均滿意度 (Q4a/5)', '=IFERROR(AVERAGE(配對分析!W2:W),"")'],
    ['平均 NPS 分數 (Q4b/10)', '=IFERROR(AVERAGE(配對分析!X2:X),"")'],
    ['NPS 推薦者 %（>=9）', '=IFERROR(COUNTIF(配對分析!X2:X,">="&9)/COUNTIF(配對分析!X2:X,"<>"),"")'],
    ['NPS 批評者 %（<=6）', '=IFERROR(COUNTIF(配對分析!X2:X,"<="&6)/COUNTIF(配對分析!X2:X,"<>"),"")'],
    ['最多人選的最佳環節', modeTextFormula('配對分析!U2:U')],
    ['最多人仍擔心的障礙', modeTextFormula('配對分析!V2:V')]
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

  sheet.setColumnWidth(1, 240);
  sheet.setColumnWidth(2, 200);
}

function modeTextFormula(rangeA1) {
  return '=IFERROR(INDEX(QUERY({' + rangeA1 + '},"select Col1, count(Col1) where Col1 is not null group by Col1 order by count(Col1) desc label count(Col1) \'\'",0),1,1),"")';
}

function ensureRows(sheet, rowCount) {
  var current = sheet.getMaxRows();
  if (current < rowCount) {
    sheet.insertRowsAfter(current, rowCount - current);
  }
}
