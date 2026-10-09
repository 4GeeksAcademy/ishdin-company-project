import sys
from pathlib import Path


REPOSITORY_ROOT = str(Path(__file__).resolve().parents[3])
if REPOSITORY_ROOT not in sys.path:
	sys.path.insert(0, REPOSITORY_ROOT)
