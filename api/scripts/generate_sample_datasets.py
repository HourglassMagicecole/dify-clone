#!/usr/bin/env python
"""Generate sample RAG datasets for education platform testing."""

import json
import random
from datetime import datetime
from typing import Any
from uuid import uuid4


def generate_dataset(index: int) -> dict[str, Any]:
    """Generate a sample RAG dataset with educational content."""
    dataset_configs = [
        {
            "name": "LLM Fundamentals Knowledge Base",
            "description": "Comprehensive guide to Large Language Models",
            "category": "education",
            "documents": generate_llm_documents(),
        },
        {
            "name": "Agent Building Best Practices",
            "description": "Expert guidelines for building AI agents",
            "category": "technical",
            "documents": generate_agent_documents(),
        },
        {
            "name": "Workflow Patterns Library",
            "description": "Common workflow patterns and implementations",
            "category": "patterns",
            "documents": generate_workflow_documents(),
        },
    ]

    config = dataset_configs[index % len(dataset_configs)]

    dataset = {
        "id": str(uuid4()),
        "name": config["name"],
        "description": config["description"],
        "provider": "openai",
        "embedding_model": "text-embedding-3-small",
        "permission": "all_team",
        "indexing_technique": "high_quality",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "document_count": len(config["documents"]),
        "word_count": sum(len(doc["content"].split()) for doc in config["documents"]),
        "app_count": random.randint(1, 5),
        "config": {
            "retrieval_model": {
                "search_method": "hybrid",
                "reranking_enable": True,
                "reranking_mode": "weighted",
                "weights": {"vector": 0.7, "keyword": 0.3},
                "top_k": 5,
                "score_threshold": 0.7,
            },
            "embedding_model_config": {
                "provider": "openai",
                "model_name": "text-embedding-3-small",
                "dimensions": 1536,
            },
            "processing": {
                "chunk_size": 500,
                "chunk_overlap": 50,
                "separator": "\n\n",
                "clean_method": "default",
            },
        },
        "documents": config["documents"],
        "education_metadata": {
            "category": config["category"],
            "difficulty": "intermediate",
            "topics": extract_topics(config["documents"]),
            "language": "en",
            "last_indexed": datetime.utcnow().isoformat(),
        },
    }

    return dataset


def generate_llm_documents() -> list[dict[str, Any]]:
    """Generate documents about LLM fundamentals."""
    documents = [
        {
            "id": str(uuid4()),
            "title": "Introduction to Large Language Models",
            "content": """Large Language Models (LLMs) are neural network-based models trained on vast amounts of text data.
            They can understand and generate human-like text, making them powerful tools for various NLP tasks.

            Key concepts:
            - Transformer architecture
            - Attention mechanisms
            - Pre-training and fine-tuning
            - Tokenization
            - Context windows

            Popular models include GPT-4, Claude, PaLM, and LLaMA.""",
            "metadata": {"topic": "basics", "level": "beginner"},
        },
        {
            "id": str(uuid4()),
            "title": "Prompt Engineering Techniques",
            "content": """Effective prompt engineering is crucial for getting the best results from LLMs.

            Key techniques:
            1. Clear instructions: Be specific about what you want
            2. Few-shot learning: Provide examples in your prompt
            3. Chain-of-thought: Ask the model to explain its reasoning
            4. Role-playing: Assign a specific role or expertise
            5. Structured output: Request specific formats

            Example of few-shot prompting:
            Task: Classify sentiment
            Example 1: "I love this!" -> Positive
            Example 2: "This is terrible" -> Negative
            Input: "Not bad at all" -> ?""",
            "metadata": {"topic": "prompting", "level": "intermediate"},
        },
        {
            "id": str(uuid4()),
            "title": "Fine-tuning and Customization",
            "content": """Fine-tuning allows you to customize LLMs for specific tasks or domains.

            Methods:
            - Full fine-tuning: Update all model parameters
            - LoRA: Low-rank adaptation for efficient fine-tuning
            - Prompt tuning: Optimize prompt embeddings
            - Instruction tuning: Train on instruction-following datasets

            Best practices:
            - Use high-quality, task-specific data
            - Monitor for overfitting
            - Evaluate on held-out test sets
            - Consider compute and storage costs""",
            "metadata": {"topic": "fine-tuning", "level": "advanced"},
        },
    ]
    return documents


def generate_agent_documents() -> list[dict[str, Any]]:
    """Generate documents about agent building."""
    documents = [
        {
            "id": str(uuid4()),
            "title": "Agent Architecture Patterns",
            "content": """AI agents combine LLMs with tools and memory to perform complex tasks.

            Common architectures:
            1. ReAct: Reasoning and Acting pattern
            2. Tool-use agents: LLMs that can call external APIs
            3. Multi-agent systems: Multiple specialized agents working together
            4. Memory-augmented agents: Agents with long-term memory

            Key components:
            - Planning: Breaking down complex tasks
            - Execution: Taking actions and using tools
            - Observation: Processing feedback
            - Memory: Storing and retrieving information""",
            "metadata": {"topic": "architecture", "level": "intermediate"},
        },
        {
            "id": str(uuid4()),
            "title": "Tool Integration for Agents",
            "content": """Tools extend agent capabilities beyond text generation.

            Common tool categories:
            - Search tools: Web search, knowledge base queries
            - Computation: Calculator, code interpreter
            - APIs: Weather, databases, external services
            - File operations: Read, write, modify files

            Implementation tips:
            1. Define clear tool descriptions
            2. Handle errors gracefully
            3. Implement rate limiting
            4. Validate tool outputs
            5. Log tool usage for debugging""",
            "metadata": {"topic": "tools", "level": "intermediate"},
        },
        {
            "id": str(uuid4()),
            "title": "Agent Memory Systems",
            "content": """Memory enables agents to maintain context and learn from experience.

            Types of memory:
            - Short-term: Current conversation context
            - Long-term: Persistent knowledge storage
            - Episodic: Past interactions and outcomes
            - Semantic: Facts and relationships

            Storage solutions:
            - Vector databases for semantic search
            - Key-value stores for quick lookups
            - Graph databases for relationships
            - Traditional databases for structured data""",
            "metadata": {"topic": "memory", "level": "advanced"},
        },
    ]
    return documents


def generate_workflow_documents() -> list[dict[str, Any]]:
    """Generate documents about workflow patterns."""
    documents = [
        {
            "id": str(uuid4()),
            "title": "Sequential Processing Workflows",
            "content": """Sequential workflows process data through a series of steps.

            Use cases:
            - Data pipelines
            - Content generation
            - Multi-step reasoning

            Best practices:
            1. Keep each step focused on one task
            2. Pass context between steps
            3. Handle errors at each stage
            4. Log intermediate results
            5. Implement checkpoints for long workflows

            Example: Document processing
            Step 1: Extract text -> Step 2: Summarize -> Step 3: Categorize -> Step 4: Store""",
            "metadata": {"topic": "patterns", "level": "beginner"},
        },
        {
            "id": str(uuid4()),
            "title": "Conditional Branching Patterns",
            "content": """Conditional workflows route processing based on conditions.

            Common patterns:
            - If-else branching
            - Switch-case routing
            - Weighted routing
            - A/B testing flows

            Implementation:
            1. Define clear conditions
            2. Handle all possible branches
            3. Provide default paths
            4. Test edge cases
            5. Monitor branch usage

            Example: Customer support routing
            If sentiment = negative -> Escalate to human
            Else if category = billing -> Billing workflow
            Else -> General support workflow""",
            "metadata": {"topic": "branching", "level": "intermediate"},
        },
        {
            "id": str(uuid4()),
            "title": "Parallel Processing Patterns",
            "content": """Parallel workflows execute multiple tasks simultaneously.

            Benefits:
            - Reduced latency
            - Better resource utilization
            - Improved throughput

            Challenges:
            - Synchronization
            - Resource management
            - Error handling

            Patterns:
            1. Fork-join: Split and merge results
            2. Pipeline: Parallel stages
            3. Map-reduce: Distributed processing
            4. Scatter-gather: Broadcast and collect

            Best practices:
            - Use when tasks are independent
            - Implement proper synchronization
            - Handle partial failures
            - Monitor resource usage""",
            "metadata": {"topic": "parallel", "level": "advanced"},
        },
    ]
    return documents


def extract_topics(documents: list[dict[str, Any]]) -> list[str]:
    """Extract unique topics from documents."""
    topics = set()
    for doc in documents:
        if "metadata" in doc and "topic" in doc["metadata"]:
            topics.add(doc["metadata"]["topic"])
    return sorted(list(topics))


def main() -> None:
    """Generate and save sample datasets."""
    datasets = []

    print("Generating 3 sample RAG datasets...")
    for i in range(3):
        dataset = generate_dataset(i)
        datasets.append(dataset)
        print(f"  - Generated: {dataset['name']}")
        print(f"    Documents: {dataset['document_count']}")
        print(f"    Words: {dataset['word_count']}")

    # Save to file
    output_file = "sample_datasets.json"
    with open(output_file, "w") as f:
        json.dump(datasets, f, indent=2)

    print("\n✅ Successfully generated 3 RAG datasets")
    print(f"📁 Saved to: {output_file}")
    print(f"📄 Total documents: {sum(d['document_count'] for d in datasets)}")
    print(f"📝 Total words: {sum(d['word_count'] for d in datasets)}")


if __name__ == "__main__":
    main()