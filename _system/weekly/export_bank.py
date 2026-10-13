import importlib
import json
from pathlib import Path
import re
import sys
import tempfile
import zipfile


def export_bank() -> None:
    root = Path(__file__).resolve().parents[2]
    archive = root / "_system" / "planner_generator_backup.zip"
    with tempfile.TemporaryDirectory(prefix="vyom-weekly-bank-") as temporary:
        folder = Path(temporary)
        with zipfile.ZipFile(archive) as backup:
            for name in backup.namelist():
                if re.fullmatch(r"papers/(?:dtests_.*|p[0-9].*|pb)\.py", name):
                    (folder / Path(name).name).write_bytes(backup.read(name))
        sys.path.insert(0, str(folder))
        daily = {}
        papers = {}
        for source in sorted(folder.glob("*.py")):
            if source.stem.startswith("dtests_"):
                data = importlib.import_module(source.stem).D
                duplicate = daily.keys() & data.keys()
                if duplicate:
                    raise ValueError(f"Duplicate daily questions: {duplicate}")
                daily.update(data)
            elif re.fullmatch(r"p\d+_.*", source.stem):
                paper = importlib.import_module(source.stem).PAPER
                original_date = re.search(r"\d{4}-\d{2}-\d{2}", paper["file"])
                if original_date is None:
                    raise ValueError(f"Paper date missing: {source.name}")
                date = original_date.group()
                if date in papers:
                    raise ValueError(f"Duplicate paper for {date}")
                papers[date] = paper
        for date, test in daily.items():
            if sum(question[0] for question in test["qs"]) != 10:
                raise ValueError(f"Daily marks do not total 10: {date}")
            if len(test["qs"]) != len(test["key"]):
                raise ValueError(f"Daily key mismatch: {date}")
        for date, paper in papers.items():
            questions = [q for section in paper["sections"] for q in section["qs"]]
            if sum(q["m"] for q in questions) != paper["marks"]:
                raise ValueError(f"Paper marks mismatch: {date}")
            if len(questions) != len(paper["key"]):
                raise ValueError(f"Paper key mismatch: {date}")
        output = Path(__file__).with_name("question-bank.json")
        output.write_text(
            json.dumps({"daily": daily, "papers": papers}, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"Exported {len(daily)} daily tests and {len(papers)} papers.")


if __name__ == "__main__":
    export_bank()
