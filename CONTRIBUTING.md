# Contributing to Metriva

Thank you for your interest in contributing to **Metriva**!

---

## Licensing & Contributions

Metriva is released under the **Business Source License 1.1 (BSL 1.1)**, converting automatically to the **Apache License, Version 2.0** on the Change Date (October 24, 2030 or the fourth anniversary of first public distribution).

Before contributing code, documentation, or enhancements to Metriva:
1. **Original Work & DCO:** Contributors certify that their contributions are their original work or that they have the full legal right to submit them.
2. **Contributor Agreement Requirement:** To ensure clear intellectual property provenance without ambiguous implied terms, contributors of substantial pull requests will be asked to sign an explicit Contributor License Agreement (CLA) or assign rights for inclusion under Metriva's BSL 1.1 license.
3. **No Automatic Rights Waiver:** Simply filing an issue or submitting a code suggestion does not automatically transfer copyright or imply assignment without an executed agreement.

---

## Development Setup

### 1. Prerequisites
- Python 3.12+
- Node.js 22+
- PostgreSQL 16+ (or local SQLite for lightweight testing)

### 2. Local Environment
```bash
# Clone the repository
git clone https://github.com/your-username/metriva.git
cd metriva

# Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Run migrations & seed demo data
python backend/manage.py migrate
python backend/manage.py seed_database --scale demo --seed 42

# Install frontend dependencies & run dev server
cd frontend
npm install
npm run dev
```

---

## Running Quality Checks

### 1. Pytest Test Suite (149 Tests)
```bash
pytest backend/tests/ -v
```

### 2. Security Hardening Suite (16 Checks)
```bash
pytest backend/tests/test_security_hardening.py -v
```

### 3. Ruff Linter & Formatting
```bash
ruff check backend/
```

### 4. Frontend Vitest Suite (38 Tests)
```bash
cd frontend && npm test -- --run
```

### 5. Frontend Production Build
```bash
cd frontend && npm run build
```

---

## Pull Request Guidelines
1. Ensure all tests pass (`pytest` and `vitest`) and linting reports no errors (`ruff check`).
2. Include unit or integration tests for new features or bug fixes.
3. Write clean, descriptive git commit messages following the Conventional Commits specification (`feat:`, `fix:`, `docs:`, `test:`).
