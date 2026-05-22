# Technical Paper: Project Parasite - A Multi-Modal Intelligence System for Community Behavioral Mapping

**Abstract**  
Project Parasite is a specialized intelligence and analytics platform designed to decode and map the complex social and economic interactions within high-frequency livestream communities. By leveraging Large Language Models (LLMs) for multi-lingual knowledge extraction and graph-based data modeling, Parasite transforms raw chat logs into a structured Knowledge Graph. This paper details the end-to-end architecture, from local LLM-powered triplet extraction to a high-performance Next.js visualization dashboard.

---

## 1. Introduction
Modern digital communities, particularly those centered around niche financial or social ecosystems, generate massive amounts of unstructured data. These environments often employ a mix of languages (e.g., English and Moroccan Darija) and community-specific slang that standard sentiment analysis tools fail to interpret. Project Parasite was developed to bridge this gap, providing a "military-grade" intelligence dashboard for community administrators and researchers to visualize influence, sentiment, and knowledge transfer.

## 2. System Architecture

### 2.1 Data Ingestion & Persistence
The system utilizes PostgreSQL for unified storage, ingestion, and extraction:
*   **Unified Data Layer:** PostgreSQL is used for rapid, high-throughput ingestion of chat logs, relationship triplet storage, and dynamic analytical querying, serving as the single source of truth across all scripts and Next.js APIs.
*   **Production Delivery:** The Next.js application connects directly to the same unified database layer (local or cloud Supabase) to deliver real-time profiling insights and force-directed graph rendering.

### 2.2 LLM-Powered Knowledge Extraction
The core intelligence layer, `generate_graph_map.py`, utilizes a batch-processing engine that feeds chat segments into a local LLM (Gemma-4-e2b).
*   **Multi-lingual Normalization:** The system translates Moroccan Darija and community slang into a standardized English ontology in real-time during extraction.
*   **Triplet Extraction:** The LLM is prompted to output JSON-formatted triplets (Subject, Relation, Object) based on a strict community-specific ontology (e.g., `SHARED_ADVICE`, `ADMITTED_FAILURE`, `DONATED_TO`).
*   **Ontology Enforcement:** A curated knowledge context is provided to the LLM to ensure accurate interpretation of terms like *"Yajoura"* (consistency) or *"Parasite"* (digital freelancer).

## 3. Visualization and Discovery

### 3.1 Force-Directed Graph Mapping
The project features an interactive 2D graph visualization using `react-force-graph-2d` and D3.js. This allows users to:
*   Identify "Super-Nodes" (influential community members).
*   Visualize clusters of topic-based discussions.
*   Explore second-degree associations between users and financial tools.

### 3.2 User Profiling & Behavioral Insights
The "Profiler" module uses AI to aggregate extracted triplets and generate high-level behavioral archetypes for community members. Using `react-virtuoso` for virtualization, the dashboard handles thousands of profiles with sub-millisecond rendering performance.

## 4. Technology Stack

### 4.1 Backend & AI
- **Language:** Python 3.11+
- **Database:** Supabase / PostgreSQL (Unified local & production database)
- **AI Models:** Google Gemma-4-e2b (Local via LM Studio), OpenAI API
- **Graph Logic:** PostgreSQL relational mapping
- **Data Engineering:** `tqdm` for progress tracking, `json` for structured extraction

### 4.2 Frontend (Next_Parasite_App)
- **Framework:** Next.js 16.2 (App Router)
- **Runtime:** React 19
- **Styling:** Tailwind CSS 4 (Vanguard aesthetic)
- **Visualization:** D3.js, `react-force-graph-2d`
- **Performance:** `react-virtuoso` (List Virtualization), React Server Components (RSC)
- **UI Components:** Lucide React for iconography, custom "Intelligence Agency" themed UI

## 5. Linguistic & Cultural Context
A significant innovation in Project Parasite is its handling of **Moroccan Darija**. By embedding cultural knowledge directly into the LLM system prompt, the system can extract semantic meaning from phrases that are otherwise opaque to generic AI models. This allows for the mapping of an "underground" economy and social structure with high fidelity.

## 6. Conclusion
Project Parasite demonstrates the power of combining local LLM capabilities with modern web visualization to create specialized intelligence tools. By moving beyond simple text search to semantic graph mapping, the system provides a comprehensive view of community dynamics that was previously inaccessible.

---
*Technical Paper - Version 1.0*  
*Generated for the Parasite Intelligence Project*
