#!/usr/bin/env python3
"""Package quiz.html + one or more assessments from config.json into
self-contained HTML files that students can open by double-clicking,
with no local server and no internet connection required.

config.json holds a list of assessments:
    {"assessments": [{"examLabel": ..., "assetsDir": ..., "keysFile": ...,
                       "repoDir": ..., "questionCount": ..., ...}, ...]}

Each assessment's assetsDir/keysFile/repoDir are resolved relative to
config.json's own directory, so results don't depend on the caller's CWD.

Usage:
    python3 build_bundle.py                          # builds every assessment
    python3 build_bundle.py --config other.json
    python3 build_bundle.py --only Formative_Assessment_114
    python3 build_bundle.py --dist-dir dist/week3
"""
import argparse
import base64
import json
import re
import sys
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
DIST_DIR = APP_DIR / "dist"


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def encode_images(keys, repo_dir):
    images = {}
    missing = []
    for filename in keys:
        path = repo_dir / filename
        if not path.exists():
            missing.append(filename)
            continue
        data = base64.b64encode(path.read_bytes()).decode("ascii")
        images[filename] = "data:image/png;base64," + data
    if missing:
        print(f"Warning: {len(missing)} image(s) referenced in the keys file "
              f"are missing from {repo_dir}:", file=sys.stderr)
        for name in missing:
            print("  -", name, file=sys.stderr)
    return images


def sanitize_filename(name):
    return re.sub(r'[\\/:*?"<>|]+', "_", name).strip() or "quiz"


def build_one(assessment, app_dir, dist_dir):
    assets_dir = (app_dir / assessment["assetsDir"]).resolve()
    keys_path = assets_dir / assessment["keysFile"]
    repo_dir = assets_dir / assessment.get("repoDir", "repo")
    keys = load_json(keys_path)

    images = encode_images(keys, repo_dir)
    keys = {k: v for k, v in keys.items() if k in images}
    if not keys:
        raise RuntimeError("no questions to bundle — check keysFile/repoDir/assetsDir")

    client_config = {k: v for k, v in assessment.items() if k != "assetsDir"}
    quiz_data = {"config": client_config, "keys": keys, "images": images}

    template = (app_dir / "quiz.html").read_text(encoding="utf-8")
    if "<!--QUIZ_DATA-->" not in template:
        raise RuntimeError("quiz.html is missing the <!--QUIZ_DATA--> injection point")
    injection = "<script>window.QUIZ_DATA = " + json.dumps(quiz_data, ensure_ascii=False) + ";</script>"
    bundled = template.replace("<!--QUIZ_DATA-->", injection)

    dist_dir.mkdir(parents=True, exist_ok=True)
    output_path = dist_dir / (sanitize_filename(assessment.get("examLabel", "quiz")) + "_quiz.html")
    output_path.write_text(bundled, encoding="utf-8")

    return output_path, len(keys)


def build_all(config_path, dist_dir, only=None):
    config = load_json(config_path)
    assessments = config["assessments"]
    if only:
        assessments = [a for a in assessments if a.get("examLabel") == only]
        if not assessments:
            raise SystemExit(f"No assessment with examLabel={only!r} found in {config_path}")

    app_dir = config_path.resolve().parent
    total = len(assessments)
    built = 0
    for assessment in assessments:
        label = assessment.get("examLabel", "?")
        try:
            output_path, count = build_one(assessment, app_dir, dist_dir)
        except Exception as e:
            print(f"Warning: skipped {label!r}: {e}", file=sys.stderr)
            continue
        size_mb = output_path.stat().st_size / 1_000_000
        print(f"Wrote {output_path} ({count} questions, {size_mb:.1f} MB)")
        built += 1

    print(f"Built {built}/{total} assessments")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", default=str(APP_DIR / "config.json"),
                         help="Path to config.json (default: ./config.json)")
    parser.add_argument("--dist-dir", default=str(DIST_DIR),
                         help="Output directory for bundled HTML files (default: ./dist)")
    parser.add_argument("--only", default=None, metavar="EXAM_LABEL",
                         help="Only build the assessment with this examLabel")
    args = parser.parse_args()
    build_all(Path(args.config), Path(args.dist_dir), only=args.only)


if __name__ == "__main__":
    main()
