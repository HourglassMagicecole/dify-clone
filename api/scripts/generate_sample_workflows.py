#!/usr/bin/env python
"""Generate sample workflows for education platform testing."""

import json
import random
from datetime import datetime
from typing import Any
from uuid import uuid4


def generate_workflow(index: int) -> dict[str, Any]:
    """Generate a sample workflow with educational content."""
    workflow_types = [
        ("Customer Support Automation", "chatbot", ["llm", "condition", "answer"]),
        ("Data Analysis Pipeline", "workflow", ["llm", "code", "http", "tool"]),
        ("Content Generation Flow", "workflow", ["llm", "template", "variable", "answer"]),
        ("RAG Q&A System", "workflow", ["knowledge", "llm", "answer"]),
        ("Multi-Agent Collaboration", "workflow", ["llm", "iteration", "condition", "answer"]),
    ]

    name, mode, node_types = workflow_types[index % len(workflow_types)]

    workflow = {
        "id": str(uuid4()),
        "name": f"{name} - Sample {index + 1}",
        "mode": mode,
        "description": f"Educational workflow demonstrating {name.lower()} concepts",
        "icon": "workflow",
        "icon_background": "#1C64F2",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "tags": ["education", "sample", mode],
        "config": {
            "version": "1.0",
            "nodes": generate_nodes(node_types),
            "edges": generate_edges(node_types),
            "variables": generate_variables(),
        },
        "education_metadata": {
            "difficulty": random.choice(["beginner", "intermediate", "advanced"]),
            "learning_objectives": [
                f"Understand {mode} workflows",
                f"Learn {', '.join(node_types)} node types",
                "Practice workflow design patterns",
            ],
            "estimated_time_minutes": random.randint(15, 60),
            "prerequisites": ["Basic LLM understanding", "Workflow concepts"],
        },
    }

    return workflow


def generate_nodes(node_types: list[str]) -> list[dict[str, Any]]:
    """Generate workflow nodes based on types."""
    nodes = [
        {
            "id": "start",
            "type": "start",
            "position": {"x": 100, "y": 200},
            "data": {
                "title": "Start",
                "desc": "Workflow entry point",
                "variables": ["input_text", "user_id"],
            },
        }
    ]

    x_pos = 300
    for i, node_type in enumerate(node_types):
        node = {
            "id": f"{node_type}_{i}",
            "type": node_type,
            "position": {"x": x_pos, "y": 200},
            "data": generate_node_data(node_type, i),
        }
        nodes.append(node)
        x_pos += 200

    nodes.append({
        "id": "end",
        "type": "end",
        "position": {"x": x_pos, "y": 200},
        "data": {
            "title": "End",
            "desc": "Workflow completion",
            "outputs": ["result", "metadata"],
        },
    })

    return nodes


def generate_node_data(node_type: str, index: int) -> dict[str, Any]:
    """Generate node-specific data based on type."""
    node_configs = {
        "llm": {
            "title": f"LLM Node {index + 1}",
            "desc": "Process with language model",
            "model": "gpt-4",
            "prompt": "Process the following input: {{input}}",
            "max_tokens": 500,
            "temperature": 0.7,
        },
        "condition": {
            "title": f"Condition {index + 1}",
            "desc": "Conditional branching",
            "conditions": [
                {"var": "score", "op": ">", "value": 0.8},
                {"var": "category", "op": "==", "value": "important"},
            ],
        },
        "code": {
            "title": f"Code Execution {index + 1}",
            "desc": "Python code execution",
            "code": "result = input_data['value'] * 2\nreturn {'result': result}",
            "language": "python",
        },
        "http": {
            "title": f"API Call {index + 1}",
            "desc": "External API request",
            "method": "POST",
            "url": "https://api.example.com/process",
            "headers": {"Content-Type": "application/json"},
        },
        "knowledge": {
            "title": f"Knowledge Retrieval {index + 1}",
            "desc": "RAG knowledge base query",
            "dataset_id": str(uuid4()),
            "top_k": 5,
            "score_threshold": 0.7,
        },
        "template": {
            "title": f"Template {index + 1}",
            "desc": "Text template transformation",
            "template": "Dear {{name}},\n\n{{content}}\n\nBest regards,\n{{sender}}",
        },
        "variable": {
            "title": f"Variable {index + 1}",
            "desc": "Variable assignment",
            "variable_name": f"var_{index}",
            "value_type": "string",
        },
        "tool": {
            "title": f"Tool {index + 1}",
            "desc": "External tool integration",
            "tool_name": "web_search",
            "parameters": {"query": "{{search_query}}", "limit": 10},
        },
        "iteration": {
            "title": f"Loop {index + 1}",
            "desc": "Iterative processing",
            "iterator": "items",
            "max_iterations": 10,
        },
        "answer": {
            "title": f"Answer {index + 1}",
            "desc": "Generate response",
            "answer_format": "markdown",
            "variables": ["result", "metadata"],
        },
    }

    return node_configs.get(node_type, {
        "title": f"{node_type.title()} Node",
        "desc": f"Process with {node_type}",
    })


def generate_edges(node_types: list[str]) -> list[dict[str, Any]]:
    """Generate connections between nodes."""
    edges = []
    prev_id = "start"

    for i, node_type in enumerate(node_types):
        current_id = f"{node_type}_{i}"
        edges.append({
            "id": f"edge_{i}",
            "source": prev_id,
            "target": current_id,
            "type": "default",
        })
        prev_id = current_id

    edges.append({
        "id": "edge_final",
        "source": prev_id,
        "target": "end",
        "type": "default",
    })

    return edges


def generate_variables() -> list[dict[str, Any]]:
    """Generate workflow variables."""
    return [
        {
            "name": "input_text",
            "type": "string",
            "required": True,
            "description": "Main input text for processing",
        },
        {
            "name": "user_id",
            "type": "string",
            "required": True,
            "description": "User identifier",
        },
        {
            "name": "temperature",
            "type": "number",
            "required": False,
            "default": 0.7,
            "description": "LLM temperature setting",
        },
        {
            "name": "max_iterations",
            "type": "number",
            "required": False,
            "default": 5,
            "description": "Maximum loop iterations",
        },
    ]


def main() -> None:
    """Generate and save sample workflows."""
    workflows = []

    print("Generating 5 sample workflows...")
    for i in range(5):
        workflow = generate_workflow(i)
        workflows.append(workflow)
        print(f"  - Generated: {workflow['name']}")

    # Save to file
    output_file = "sample_workflows.json"
    with open(output_file, "w") as f:
        json.dump(workflows, f, indent=2)

    print("\n✅ Successfully generated 5 workflows")
    print(f"📁 Saved to: {output_file}")
    print(f"📊 Total nodes: {sum(len(w['config']['nodes']) for w in workflows)}")
    print(f"🔗 Total edges: {sum(len(w['config']['edges']) for w in workflows)}")


if __name__ == "__main__":
    main()