# 🕵️‍♂️ Project Parasite: Community Slang & Influence Intelligence Platform

Project Parasite is a military-grade behavioral mapping and community analytics platform designed to ingest high-frequency livestream chat logs, parse them using state-of-the-art local LLMs, and structure them into a multi-dimensional **Knowledge Graph**. By standardizing niche cultural slang and multi-lingual conversations into a clean, queryable relationship ontology, Parasite exposes hidden community dynamics, user reputations, and knowledge transfers.

---

## 🌟 Key Features

*   **Dynamic Slang & Context System (`knowledge.md`)**: Empower administrators to define and modify custom community terms, aliases, and cultural slang in real-time. No code changes required.
*   **LLM-Powered Triplet Extraction**: Uses an offline, high-performance LLM (such as Gemma-4-e2b via LM Studio) to translate, normalize, and extract subject-relation-object triplets from raw chat logs.
*   **Next.js Dynamic Visualizer Dashboard**: A premium, interactive frontend dashboard presenting user behavior profiling, psychological intelligence reports, and a force-directed graph rendering built directly into the web application.
*   **User Behavioral Profiling**: Deep psychological and community-standing profiling powered by an AI system that translates historical chat logs and graph connections into action-oriented intelligence reports.
*   **PostgreSQL Architecture**: Unified analysis using **PostgreSQL** for batch processing, relationship mapping, and production web delivery, simplifying database management and deployment.

---

## 🏗️ System Architecture

```mermaid
graph TD
    A[YouTube / Livestream Chat Logs] --> B[PostgreSQL Ingestion]
    B --> C[generate_graph_map.py / graphragtest.py]
    D[knowledge.md Central Slang File] --> C
    C --> E[Local Gemma LLM via LM Studio]
    E -->|JSON Triplets| B
    B --> G[Next.js App Server Router]
    D -->|Real-time Prompt Injection| G
    G --> H[Next.js Dynamic Dashboard UI]
    H --> I[2D Force-Directed Interaction Graph]
    H --> J[User Profiler & Psychology Reports]
```

---

## 🚀 Getting Started

### Prerequisites

*   **Python 3.11+**
*   **Node.js 18+** & **npm**
*   **LM Studio** (or another local LLM provider running Gemma-4-e2b or equivalent at `http://localhost:1234/v1`)
*   **PostgreSQL** (or a Supabase instance)

---

### 📥 1. Backend & Data Pipeline Setup

1.  **Install Python dependencies**:
    ```bash
    pip install psycopg2-binary openai networkx tqdm
    ```
2.  **Configure environment**:
    Create a `.env` file in the project root or configure environment variables directly:
    ```bash
    DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/parasite"
    ```
3.  **Run the local graph map extractor**:
    ```bash
    python generate_graph_map.py
    ```

---

### 🎨 2. Frontend Dashboard Setup

1.  **Navigate into the Next.js app**:
    ```bash
    cd next_parasite_app
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure local environment**:
    Create or edit `.env` inside `next_parasite_app`:
    ```bash
    DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/parasite"
    ```
4.  **Start the development server**:
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧠 Dynamic Slang Customization (`knowledge.md`)

You can modify how the AI interprets specific community terms and user personas by writing directly to `knowledge.md` in the root of the project.

Example content:
```markdown
- zouhir is the stream host
- parasite is someone who works online but is slightly unpolished
- yajoura means brick, symbolizing extreme consistency (brick by brick)
```

The system automatically loads this file:
1.  **During Triplet Extraction**: Python scripts load it into the system prompt to avoid mischaracterizing community slang.
2.  **During Profile Generation**: Next.js api routes read it on each profiling request, immediately adapting to new terms without requiring any server restarts!

---

## 🛠️ Verification Commands

Ensure all components are syntactically and structurally sound before deployment:

*   **Python Compilations**:
    ```bash
    python -m py_compile graphragtest.py generate_graph_map.py pipeline/generate_graph.py
    ```
*   **Next.js TypeScript Checks**:
    ```bash
    cd next_parasite_app
    npx tsc --noEmit
    ```
