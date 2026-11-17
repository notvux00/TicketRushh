"""Build Linux x86_64/Python 3.12 dependencies, including on Windows."""

from pathlib import Path
import shutil
import subprocess
import sys


def main():
    root = Path(__file__).resolve().parent
    package = root / ".build" / "package"
    # Only remove this script's fixed, resolved build directory.
    assert package.parent == root / ".build"
    if package.exists():
        shutil.rmtree(package)
    package.mkdir(parents=True)
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--platform", "manylinux2014_x86_64",
         "--implementation", "cp", "--python-version", "3.12", "--abi", "cp312",
         "--only-binary=:all:", "--no-compile", "--target", str(package),
         "-r", str(root / "requirements.txt")],
        check=True,
    )
    shutil.copy2(root / "maintenance.py", package / "maintenance.py")
    print(f"Lambda package ready: {package}")


if __name__ == "__main__":
    main()
