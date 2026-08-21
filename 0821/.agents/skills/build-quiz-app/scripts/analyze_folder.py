#!/usr/bin/env python3
"""Analyze a problem-set folder (question images + an answer-key JSON) and
report its structure: keys file, image folder, per-question answer letters,
multi-answer questions, and an inferred filenamePattern for config.json.

Usage:
    python3 analyze_folder.py <folder> [--keys-file NAME] [--repo-dir NAME]

Prints a JSON report to stdout; never writes anything.
"""
import argparse
import json
import re
import sys
from pathlib import Path


def find_keys_file(folder, explicit):
    if explicit:
        return folder / explicit, None
    candidates = sorted(folder.glob("*.json"))
    if len(candidates) == 1:
        return candidates[0], None
    return None, [c.name for c in candidates]


def find_repo_dir(folder, keys, explicit):
    if explicit:
        return folder / explicit
    preferred = folder / "repo"
    if preferred.is_dir():
        return preferred
    best, best_count = None, -1
    for sub in [p for p in folder.iterdir() if p.is_dir()]:
        count = sum(1 for k in keys if (sub / k).exists())
        if count > best_count:
            best, best_count = sub, count
    if best_count > 0:
        return best
    if all((folder / k).exists() for k in keys):
        return folder
    return None


def last_digit_run(stem):
    matches = list(re.finditer(r"\d+", stem))
    return matches[-1] if matches else None


def infer_pattern(filenames):
    """Best-effort: find a common `{prefix}{number}{suffix}.ext` template; if
    filenames split into a handful of such templates differing by one short
    token, treat that token as an optional `group` capture. Returns
    (pattern_or_None, note)."""
    exts = {Path(f).suffix for f in filenames}
    if len(exts) != 1:
        return None, f"mixed extensions {sorted(exts)}; no single pattern"
    ext = exts.pop()

    templates = {}
    for fname in filenames:
        stem = fname[: -len(ext)] if ext else fname
        m = last_digit_run(stem)
        if not m:
            return None, "not every filename ends with a digit run before the extension"
        template = stem[: m.start()] + "\0" + stem[m.end():]
        templates.setdefault(template, []).append(fname)

    ext_re = re.escape(ext)

    if len(templates) == 1:
        template = next(iter(templates))
        prefix, suffix = template.split("\0", 1)
        pattern = "^" + re.escape(prefix) + r"(?P<number>\d+)" + re.escape(suffix) + ext_re + "$"
        return pattern, "single template — number-only pattern"

    tmpl_list = sorted(templates)

    result = _diff_by_char_position(tmpl_list, ext_re)
    if result:
        return result
    result = _diff_by_delimiter_token(tmpl_list, ext_re)
    if result:
        return result
    return None, f"{len(templates)} distinct templates, no clean single-token group found"


def _pattern_from_split(prefix, group_re_source, suffix, ext_re, is_char_class):
    group_re = ("[" + group_re_source + "]") if is_char_class else ("(?:" + group_re_source + ")")
    if "\0" in prefix:
        before, after = prefix.split("\0", 1)
        return ("^" + re.escape(before) + r"(?P<number>\d+)" + re.escape(after)
                + "(?P<group>" + group_re + ")" + re.escape(suffix) + ext_re + "$")
    if "\0" in suffix:
        before, after = suffix.split("\0", 1)
        return ("^" + re.escape(prefix) + "(?P<group>" + group_re + ")"
                + re.escape(before) + r"(?P<number>\d+)" + re.escape(after) + ext_re + "$")
    return None


def _diff_by_char_position(tmpl_list, ext_re):
    """Handles same-length templates differing by a fixed-width token, e.g.
    "115專業1Q\0" vs "115專業2Q\0" (group is always exactly one character)."""
    lengths = {len(t) for t in tmpl_list}
    if len(lengths) != 1:
        return None
    length = lengths.pop()
    diff_positions = [i for i in range(length) if len({t[i] for t in tmpl_list}) > 1]
    if not diff_positions or diff_positions[-1] - diff_positions[0] != len(diff_positions) - 1:
        return None
    i0, i1 = diff_positions[0], diff_positions[-1] + 1
    prefix, suffix = tmpl_list[0][:i0], tmpl_list[0][i1:]
    if not all(t.startswith(prefix) and t.endswith(suffix) for t in tmpl_list):
        return None
    group_chars = sorted({t[i0:i1] for t in tmpl_list})
    pattern = _pattern_from_split(prefix, "".join(re.escape(c) for c in group_chars), suffix, ext_re, True)
    if not pattern:
        return None
    return pattern, f"group token candidates: {group_chars}"


_DELIM_RE = re.compile(r"([_\-. ])")


def _diff_by_delimiter_token(tmpl_list, ext_re):
    """Handles templates that split into the same number of `_`/`-`/`.`/` `
    delimited tokens, differing in exactly one token position, regardless of
    that token's length — e.g. "math_\0" vs "science_\0"."""
    split_lists = [_DELIM_RE.split(t) for t in tmpl_list]
    lengths = {len(s) for s in split_lists}
    if len(lengths) != 1:
        return None
    length = lengths.pop()
    diff_idx = [i for i in range(length) if len({s[i] for s in split_lists}) > 1]
    if len(diff_idx) != 1:
        return None
    idx = diff_idx[0]
    if split_lists[0][idx] in ("_", "-", ".", " "):
        return None  # a delimiter itself shouldn't be the only thing varying
    prefix = "".join(split_lists[0][:idx])
    suffix = "".join(split_lists[0][idx + 1:])
    if not all("".join(s[:idx]) == prefix and "".join(s[idx + 1:]) == suffix for s in split_lists):
        return None
    group_words = sorted({s[idx] for s in split_lists})
    is_char_class = all(len(w) == 1 for w in group_words)
    group_source = "".join(re.escape(w) for w in group_words) if is_char_class else "|".join(re.escape(w) for w in group_words)
    pattern = _pattern_from_split(prefix, group_source, suffix, ext_re, is_char_class)
    if not pattern:
        return None
    return pattern, f"group token candidates: {group_words}"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("folder")
    ap.add_argument("--keys-file")
    ap.add_argument("--repo-dir")
    args = ap.parse_args()

    folder = Path(args.folder)
    report = {"folder": str(folder)}

    keys_path, candidates = find_keys_file(folder, args.keys_file)
    if keys_path is None:
        report["error"] = "ambiguous_or_missing_keys_file"
        report["candidates"] = candidates
        print(json.dumps(report, ensure_ascii=False, indent=2))
        sys.exit(1)
    if not keys_path.exists():
        report["error"] = f"keys file not found: {keys_path}"
        print(json.dumps(report, ensure_ascii=False, indent=2))
        sys.exit(1)

    keys = json.loads(keys_path.read_text(encoding="utf-8"))
    report["keysFile"] = keys_path.name
    report["questionCount"] = len(keys)

    answer_letters = sorted({c for v in keys.values() for c in v})
    multi = [k for k, v in keys.items() if len(v) > 1]
    report["answerLetters"] = answer_letters
    report["multiAnswerCount"] = len(multi)
    report["multiAnswerSample"] = multi[:5]

    repo_dir = find_repo_dir(folder, keys, args.repo_dir)
    if repo_dir is None:
        report["repoDir"] = None
    elif repo_dir == folder:
        report["repoDir"] = "."  # images sit directly in the analyzed folder, no subfolder
    else:
        report["repoDir"] = repo_dir.relative_to(folder).as_posix()
    if repo_dir is None:
        report["error"] = "could_not_locate_image_folder"
    else:
        missing = [k for k in keys if not (repo_dir / k).exists()]
        report["missingImages"] = missing[:10]
        report["missingImageCount"] = len(missing)
        extra = []
        if repo_dir.is_dir():
            image_files = {p.name for p in repo_dir.iterdir() if p.is_file()}
            extra = sorted(image_files - set(keys.keys()))
        report["extraImageFiles"] = extra[:10]
        report["extraImageFileCount"] = len(extra)

    pattern, note = infer_pattern(sorted(keys.keys()))
    if pattern:
        try:
            re.compile(pattern)  # sanity-check as Python regex (uses (?P<name>...))
            pattern = pattern.replace("(?P<", "(?<")  # convert to JS named-group syntax for config.json
        except re.error as e:
            note = f"{note}; pattern failed to compile: {e}"
            pattern = None
    report["filenamePattern"] = pattern
    report["filenamePatternNote"] = note

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
