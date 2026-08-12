/**
 * AI Agent 教學應用工作坊 (二) — 8/20、8/21 兩場 前後測問卷自動建立腳本
 * ================================================
 * 使用方式：
 *   1. 前往 https://script.google.com → 點「新增專案」
 *   2. 刪除預設內容，貼入本程式碼
 *   3. 點上方「執行」→ 選擇函式：
 *      · createAllWorkshopForms — 一次建立 8/20、8/21 兩場，各自獨立一份試算表
 *      · createFormsFor0820     — 只建立 8/20 這一場
 *      · createFormsFor0821     — 只建立 8/21 這一場
 *   4. 首次執行需授權 — 選「進階」→「前往 (不安全)」→「允許」
 *   5. 執行完成後點「查看 > 記錄」(Ctrl+Enter) 取得表單連結與試算表連結
 * ================================================
 * 產出（每個場次各一份，彼此獨立、互不影響）：
 *   · 前測 Google Form（工作坊開始時發放 QR Code）
 *   · 後測 Google Form（工作坊結束時發放 QR Code）
 *   · Google 試算表，含「前測」「後測」回應工作表，
 *     以及「配對分析」「摘要統計」「下載連結」三個分析工作表。
 * ================================================
 * 本場主題為「從教材到自主練習小工具」：教師與 AI 協作，先把教材整理成選擇題
 * 題組，再以 vibe coding 建置一個送出前不顯示答案、送出後自動批閱的靜態
 * HTML 自主練習工具。自我效能題（SE-1~5）依此改寫為：出題協作力／品質檢核
 * 力／需求拆解力／vibe coding 建置力／技術焦慮（反向計分），前後測題文完全
 * 相同以利計算變化量。後測另加一題 MVP 完成度自評（對照模組設計文件附錄
 * C-2 的最小可行功能清單），僅後測填答、不需配對前測。
 * 兩個場次各自建立獨立的試算表與表單，不互相配對、不共用回應資料；
 * 若日後加開更多梯次，只需在下方 SESSIONS 陣列新增一筆（key/label/title），
 * 不會動到既有場次已建立的表單與試算表資料。
 */

var SESSIONS = [
  { key: '0820', label: '08/20 (四)', title: '8/20 場' },
  { key: '0821', label: '08/21 (五)', title: '8/21 場' }
];

function createAllWorkshopForms() {
  SESSIONS.forEach(createWorkshopFormsForSession);
}

function createFormsFor0820() {
  return createWorkshopFormsForSession(SESSIONS[0]);
}

function createFormsFor0821() {
  return createWorkshopFormsForSession(SESSIONS[1]);
}

function createWorkshopFormsForSession(session) {
  var ss = SpreadsheetApp.create('AI Agent 工作坊 (二) 前後測資料 2026 - ' + session.title);
  var ssId = ss.getId();

  var preForm = buildPreForm(session);
  linkFormToResponseSheet(preForm, ss, '前測');

  var postForm = buildPostForm(session);
  linkFormToResponseSheet(postForm, ss, '後測');

  buildAnalysisSheet(ss, session);
  buildSummarySheet(ss, session);
  buildDownloadLinksSheet(ss);

  ['Sheet1', '工作表1'].forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) ss.deleteSheet(sheet);
  });

  DriveApp.getFileById(ssId)
    .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var msg = [session.label + ' 建立完成！', '', '試算表：', ss.getUrl(), ''];
  buildResultDownloadLinks(ss).forEach(function(link) {
    msg.push(link.label + '：');
    msg.push(link.url);
  });
  msg.push('');
  msg.push(session.label + ' 前測表單：');
  msg.push(preForm.getPublishedUrl());
  msg.push(session.label + ' 前測編輯連結：');
  msg.push('https://docs.google.com/forms/d/' + preForm.getId() + '/edit');
  msg.push('');
  msg.push(session.label + ' 後測表單：');
  msg.push(postForm.getPublishedUrl());
  msg.push(session.label + ' 後測編輯連結：');
  msg.push('https://docs.google.com/forms/d/' + postForm.getId() + '/edit');

  Logger.log(msg.join('\n'));

  try {
    SpreadsheetApp.openById(ssId).toast('完成！請查看執行記錄取得表單與試算表連結。', '建立成功', 30);
  } catch (e) {}

  return ss;
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
      title: 'SE-1 出題協作力',
      help: '我能與 AI Agent 協作，依自己的教材／講義內容，產生一份選擇題題組初稿。'
    },
    {
      title: 'SE-2 品質檢核力',
      help: '我能檢查 AI 產生的題目、選項與答案，判斷是否清楚、互斥、正確，並具體指出需要修改之處。'
    },
    {
      title: 'SE-3 需求拆解力',
      help: '我能把自己的教學需求拆成「目標、情境、限制、完成標準」的任務卡，再交給 AI 協作，而不是直接打開對話框亂試。'
    },
    {
      title: 'SE-4 vibe coding 建置力',
      help: '我能以 vibe coding 方式與 AI 協作，建立或修改一個學生可自主練習、送出後才顯示答案的靜態 HTML 小工具。'
    },
    {
      title: 'SE-5 技術焦慮（反向計分）',
      help: '我對「非資訊背景教師能否獨立完成一個可用的網頁自主練習小工具」感到技術焦慮。\n反向計分：高分 = 焦慮高，分析時 Δ < 0 代表焦慮降低。'
    }
  ];
}

function buildPreForm(session) {
  var form = FormApp.create('AI Agent 工作坊 (二) - ' + session.title + '前測問卷');
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
    .setHelpText('影響 vibe coding 建置環節的操作路徑。')
    .setChoiceValues(['macOS', 'Windows', '其他'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('P0c - 您是否已參加過「AI Agent 教學應用工作坊（一）」')
    .setHelpText('本場會延續工作坊（一）的任務卡協作方法，但未參加過也可完整參與。')
    .setChoiceValues(['是，已參加過', '否，這是我第一次參加', '不確定／記不清楚'])
    .setRequired(true);

  form.addSectionHeaderItem()
    .setTitle('出題與工具建置經驗');

  form.addMultipleChoiceItem()
    .setTitle('P1 - 您使用 AI 協助產生選擇題／測驗題的經驗')
    .setChoiceValues([
      '從未嘗試過',
      '曾嘗試但很少使用',
      '偶爾使用（例如學期中一兩次）',
      '經常使用（幾乎每次命題都會用）',
      '已有固定的出題與檢核流程'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('P2 - 工作坊結束後，您最希望能完成哪一項？')
    .setChoiceValues([
      '把自己的教材轉成一份完整的選擇題題組',
      '學會檢核 AI 產生題目的品質（答案、選項是否合理）',
      '完成一個可作答、能自動批閱的網頁小工具',
      '學會用「任務卡」把需求講清楚，讓 AI 少走彎路',
      '學會除錯：發現網頁問題後如何有效請 AI 修正'
    ])
    .setRequired(true);

  addSelfEfficacyItems(form, '前');
  return form;
}

function buildPostForm(session) {
  var form = FormApp.create('AI Agent 工作坊 (二) - ' + session.title + '後測問卷');
  configurePublicFormAccess(form);
  form.setDescription(
    '請在 ' + session.label + ' 工作坊結束後立即填寫，約需 3 分鐘。\n' +
    'SE 題目文字與前測相同，以便計算工作坊前後的變化量。\n' +
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
    .setTitle('Q2 - 今天哪個環節對您的幫助最大？')
    .setChoiceValues([
      '開場與回顧：回顧任務卡方法、預告今天的兩階段流程',
      '從教材到題組：與 AI 協作，依教材產生選擇題題組',
      '題組檢核調整：檢查題目、選項與答案，修正定稿',
      'vibe coding 實作：把題組交給 AI，建立自主練習網頁',
      '測試、送出與批閱：不先顯示答案，送出後才自動批閱並可重新作答',
      '同儕試用與交流：以學生視角試用他人的小工具並回饋'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Q3 - 工作坊後，您仍然最擔心的是哪一項？')
    .setChoiceValues([
      '不知如何把自己的教材轉成適合的題目',
      '題目品質判斷仍沒把握（答案是否正確、選項是否合理）',
      '課後不知如何獨立修改或除錯這個網頁小工具',
      '學生可能利用 AI 直接取得正確答案',
      '不知如何延伸應用到自己其他教材或單元',
      '已無明顯擔憂'
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Q3b - 您今天完成的自主練習小工具，達到以下哪些項目？（可複選）')
    .setHelpText('對照今天的最小可行功能（MVP）清單勾選您實際完成的部分；這是進度普查，不是評分，尚未完成也沒關係。')
    .setChoiceValues([
      '可正確載入並顯示全部題目與選項',
      '送出前，畫面上不會出現任何答案、分數或對錯提示',
      '送出後，會顯示答對題數、分數與逐題對錯',
      '有「重新作答」按鈕，可清空作答重來',
      '題庫資料（如 JSON／JS）與網頁程式碼是分開的兩個檔案',
      '以上都還在進行中，尚未完成'
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
 * 前測欄位：A=Timestamp B=配對代碼 C=學科 D=系統 E=參加過工作坊一
 *           F=AI出題經驗 G=期望完成項目 H-L=SE1-5（前）
 * 後測欄位：A=Timestamp B=配對代碼 C-G=SE1-5（後）
 *           H=Q2最佳環節 I=Q3仍擔心 J=Q3b MVP完成度 K=Q4a L=Q4b(NPS) M=Q5
 */
function buildAnalysisSheet(ss, session) {
  var sheet = ss.insertSheet('配對分析');

  var headers = [
    '配對代碼', '場次', '學科', '系統', '參加過工作坊一', 'AI出題經驗', '期望完成項目(前)',
    'PRE_SE1', 'PRE_SE2', 'PRE_SE3', 'PRE_SE4', 'PRE_SE5',
    'POST_SE1', 'POST_SE2', 'POST_SE3', 'POST_SE4', 'POST_SE5',
    'Δ_SE1', 'Δ_SE2', 'Δ_SE3', 'Δ_SE4', 'Δ_SE5(反向)',
    '最佳環節(後)', '仍擔心(後)', 'MVP完成度(後)', '滿意度(Q4a)', 'NPS(Q4b)', '收穫文字(Q5)'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setWrap(false);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 7).setBackground('#374151').setFontColor('#f9fafb');
  sheet.getRange(1, 8, 1, 5).setBackground('#1e3a6e').setFontColor('#bfdbfe');
  sheet.getRange(1, 13, 1, 5).setBackground('#14532d').setFontColor('#bbf7d0');
  sheet.getRange(1, 18, 1, 5).setBackground('#7c2d12').setFontColor('#fed7aa');
  sheet.getRange(1, 23, 1, 6).setBackground('#374151').setFontColor('#f9fafb');

  var preMap = {
    'A2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!B2:B))',
    'B2': '=ARRAYFORMULA(IF(前測!B2:B="","","' + session.label + '"))',
    'C2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!C2:C))',
    'D2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!D2:D))',
    'E2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!E2:E))',
    'F2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!F2:F))',
    'G2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!G2:G))',
    'H2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!H2:H))',
    'I2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!I2:I))',
    'J2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!J2:J))',
    'K2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!K2:K))',
    'L2': '=ARRAYFORMULA(IF(前測!B2:B="","",前測!L2:L))'
  };

  var postMap = {
    'M2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!C2:C},2,0),""))',
    'N2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!D2:D},2,0),""))',
    'O2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!E2:E},2,0),""))',
    'P2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!F2:F},2,0),""))',
    'Q2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!G2:G},2,0),""))',
    'W2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!H2:H},2,0),""))',
    'X2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!I2:I},2,0),""))',
    'Y2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!J2:J},2,0),""))',
    'Z2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!K2:K},2,0),""))',
    'AA2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!L2:L},2,0),""))',
    'AB2': '=ARRAYFORMULA(IFERROR(VLOOKUP(A2:A,{後測!B2:B,後測!M2:M},2,0),""))'
  };

  var deltaMap = {
    'R2': '=ARRAYFORMULA(IF((H2:H="")+(M2:M=""),"",VALUE(M2:M)-VALUE(H2:H)))',
    'S2': '=ARRAYFORMULA(IF((I2:I="")+(N2:N=""),"",VALUE(N2:N)-VALUE(I2:I)))',
    'T2': '=ARRAYFORMULA(IF((J2:J="")+(O2:O=""),"",VALUE(O2:O)-VALUE(J2:J)))',
    'U2': '=ARRAYFORMULA(IF((K2:K="")+(P2:P=""),"",VALUE(P2:P)-VALUE(K2:K)))',
    'V2': '=ARRAYFORMULA(IF((L2:L="")+(Q2:Q=""),"",VALUE(Q2:Q)-VALUE(L2:L)))'
  };

  var allFormulas = Object.assign({}, preMap, postMap, deltaMap);
  Object.keys(allFormulas).forEach(function(cell) {
    sheet.getRange(cell).setFormula(allFormulas[cell]);
  });

  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 90);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 80);
  sheet.setColumnWidth(5, 140);
  sheet.setColumnWidth(6, 180);
  sheet.setColumnWidth(7, 200);
  for (var c = 8; c <= 22; c++) sheet.setColumnWidth(c, 72);
  sheet.setColumnWidth(23, 260);
  sheet.setColumnWidth(24, 200);
  sheet.setColumnWidth(25, 260);
  sheet.setColumnWidth(26, 90);
  sheet.setColumnWidth(27, 70);
  sheet.setColumnWidth(28, 280);

  var deltaRange = sheet.getRange('R2:U1000');
  var deltaRevRange = sheet.getRange('V2:V1000');
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#dcfce7').setFontColor('#166534').setRanges([deltaRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground('#fee2e2').setFontColor('#991b1b').setRanges([deltaRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground('#dcfce7').setFontColor('#166534').setRanges([deltaRevRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground('#fee2e2').setFontColor('#991b1b').setRanges([deltaRevRange]).build()
  ]);
}

function buildSummarySheet(ss, session) {
  var sheet = ss.insertSheet('摘要統計');

  sheet.getRange(1, 1, 1, 2)
    .setValues([['指標', session.label]])
    .setBackground('#1a3a5c').setFontColor('#ffffff').setFontWeight('bold');
  sheet.setFrozenRows(1);

  var rows = [
    ['-- 回應人數 --', ''],
    ['前測回應', '=COUNTIF(前測!B2:B,"<>")'],
    ['後測回應', '=COUNTIF(後測!B2:B,"<>")'],
    ['配對完成（前+後）', '=COUNTIF(配對分析!M2:M,"<>")'],
    ['', ''],

    ['-- PRE 平均自我效能 --', ''],
    ['SE-1 出題協作力（前）', '=IFERROR(AVERAGE(前測!H2:H),"")'],
    ['SE-2 品質檢核力（前）', '=IFERROR(AVERAGE(前測!I2:I),"")'],
    ['SE-3 需求拆解力（前）', '=IFERROR(AVERAGE(前測!J2:J),"")'],
    ['SE-4 vibe coding建置力（前）', '=IFERROR(AVERAGE(前測!K2:K),"")'],
    ['SE-5 技術焦慮（前）', '=IFERROR(AVERAGE(前測!L2:L),"")'],
    ['', ''],

    ['-- POST 平均自我效能 --', ''],
    ['SE-1 出題協作力（後）', '=IFERROR(AVERAGE(後測!C2:C),"")'],
    ['SE-2 品質檢核力（後）', '=IFERROR(AVERAGE(後測!D2:D),"")'],
    ['SE-3 需求拆解力（後）', '=IFERROR(AVERAGE(後測!E2:E),"")'],
    ['SE-4 vibe coding建置力（後）', '=IFERROR(AVERAGE(後測!F2:F),"")'],
    ['SE-5 技術焦慮（後）', '=IFERROR(AVERAGE(後測!G2:G),"")'],
    ['', ''],

    ['-- 平均 Δ（POST - PRE，僅配對成功者）--', ''],
    ['Δ SE-1 出題協作力', '=IFERROR(AVERAGE(配對分析!R2:R),"")'],
    ['Δ SE-2 品質檢核力', '=IFERROR(AVERAGE(配對分析!S2:S),"")'],
    ['Δ SE-3 需求拆解力', '=IFERROR(AVERAGE(配對分析!T2:T),"")'],
    ['Δ SE-4 vibe coding建置力', '=IFERROR(AVERAGE(配對分析!U2:U),"")'],
    ['Δ SE-5 焦慮下降（反向）', '=IFERROR(AVERAGE(配對分析!V2:V),"")'],
    ['', ''],

    ['-- 後測質性摘要 --', ''],
    ['平均滿意度 (Q4a/5)', '=IFERROR(AVERAGE(後測!K2:K),"")'],
    ['平均 NPS 分數 (Q4b/10)', '=IFERROR(AVERAGE(後測!L2:L),"")'],
    ['NPS 推薦者 %（>=9）', '=IFERROR(COUNTIF(後測!L2:L,">="&9)/COUNTIF(後測!L2:L,"<>"),"")'],
    ['NPS 批評者 %（<=6）', '=IFERROR(COUNTIF(後測!L2:L,"<="&6)/COUNTIF(後測!L2:L,"<>"),"")'],
    ['最多人選的最佳環節', modeTextFormula('後測!H2:H')],
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
