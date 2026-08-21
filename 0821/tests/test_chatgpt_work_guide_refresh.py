from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "docs" / "codex-app-settings-guide.html"
ASSETS = {
    "work-surface-choice.png",
    "work-local-cloud.png",
    "work-boundaries.png",
    "work-review-loop.png",
}


class ChatGptWorkGuideRefreshTests(unittest.TestCase):
    def test_guide_uses_the_current_work_model_and_diagrams(self):
        content = GUIDE.read_text(encoding="utf-8")
        for asset in ASSETS:
            self.assertTrue((ROOT / "docs/assets/codex-app-settings-guide" / asset).is_file())
            self.assertIn(f"assets/codex-app-settings-guide/{asset}", content)
        for phrase in ("ChatGPT Work", "Work locally", "Cloud", "Chat", "Codex"):
            self.assertIn(phrase, content)
        self.assertNotIn("codex-settings-general-permissions.png", content)
        self.assertNotIn("codex-hands-on-configuration-boundaries.png", content)

    def test_bilingual_sections_have_matching_current_work_landmarks(self):
        content = GUIDE.read_text(encoding="utf-8")
        for phrase in (
            "Chat、Work 與 Codex 比較",
            "Compare Chat, Work, and Codex",
            "Work locally",
            "Cloud",
        ):
            self.assertIn(phrase, content)

    def test_guide_explains_the_windows11_update_install_and_safe_codex_setup(self):
        content = GUIDE.read_text(encoding="utf-8")
        for phrase in (
            "Windows 11",
            "not a separately installed app",
            "integrated into the ChatGPT desktop app",
            "Ask for approval",
            "Full access",
            "Work is not a separately installed app",
            "已整合到 ChatGPT 桌面版",
            "不是另外安裝的 app",
            "先要求核准",
            "完整存取權",
        ):
            self.assertIn(phrase, content)

    def test_chinese_reference_labels_are_localized_for_taiwan(self):
        content = GUIDE.read_text(encoding="utf-8")
        chinese_section = content.split('<section class="zh">', 1)[1].split("</section>", 1)[0]
        expected_labels = {
            "https://learn.chatgpt.com/docs/get-started-with-work": "OpenAI：開始使用 ChatGPT Work",
            "https://learn.chatgpt.com/docs/app": "OpenAI：ChatGPT 桌面版應用程式",
            "https://learn.chatgpt.com/docs/reference/settings": "OpenAI：ChatGPT 桌面版設定",
            "https://learn.chatgpt.com/docs/permission-modes": "OpenAI：權限設定",
            "https://learn.chatgpt.com/docs/projects": "OpenAI：Projects 與對話",
        }
        for url, label in expected_labels.items():
            self.assertIn(f'href="{url}">{label}</a>', chinese_section)

    def test_guide_explains_multi_folder_project_scope(self):
        content = GUIDE.read_text(encoding="utf-8")
        for phrase in (
            "multi-folder project",
            "every attached folder",
            "primary folder",
            "多個資料夾",
            "已加入的資料夾",
            "主要資料夾（primary folder）",
            "https://learn.chatgpt.com/docs/projects",
        ):
            self.assertIn(phrase, content)


if __name__ == "__main__":
    unittest.main()
