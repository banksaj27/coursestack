"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useCourseStore } from "@/store/useCourseStore";

const ALL_SUGGESTIONS = [
  "Measure-theoretic probability",
  "Deep learning from scratch",
  "Algebraic topology",
  "Systems design",
  "Quantum computing",
  "Compiler construction",
  "General relativity",
  "Bayesian statistics",
  "Operating systems internals",
  "Functional analysis",
  "Cryptography",
  "Reinforcement learning",
  "Differential geometry",
  "Distributed systems",
  "Number theory",
  "Computer vision",
  "Stochastic calculus",
  "Graph theory",
  "Natural language processing",
  "Abstract algebra",
  "Game theory",
  "Information theory",
  "Computational neuroscience",
  "Category theory",
  "Embedded systems",
  "Convex optimization",
  "Econometrics",
  "Topology",
  "Signal processing",
  "Computational biology",
  "Real analysis",
  "Robotics",
  "Commutative algebra",
  "Database internals",
  "Quantum field theory",
  "Statistical mechanics",
  "Formal verification",
  "Combinatorics",
  "Computer graphics",
  "Partial differential equations",
  "Representation theory",
  "Microeconomics",
  "Organic chemistry",
  "Astrophysics",
  "Molecular biology",
  "Philosophy of mind",
  "Classical mechanics",
  "Type theory",
  "Complex analysis",
  "Machine learning theory",
];

export default function TopicInput() {
  const [topic, setTopic] = useState("");
  const setTopicAction = useCourseStore((s) => s.setTopic);

  const [suggestions, setSuggestions] = useState(() => ALL_SUGGESTIONS.slice(0, 5));

  useEffect(() => {
    const shuffled = [...ALL_SUGGESTIONS].sort(() => Math.random() - 0.5);
    setSuggestions(shuffled.slice(0, 5));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = topic.trim();
    if (!text) return;
    setTopicAction(text);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex h-screen items-center justify-center bg-white"
    >
      <div className="w-full max-w-lg px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            What do you want to learn?
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Enter a topic and your AI professor will design a course for you.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" }}
          onSubmit={handleSubmit}
          className="mt-8"
        >
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={`e.g. ${suggestions[4] ?? "Measure-theoretic probability"}`}
            autoFocus
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm
                       text-neutral-900 placeholder-neutral-400 outline-none
                       transition-colors focus:border-neutral-500"
          />

          <button
            type="submit"
            disabled={!topic.trim()}
            className="mt-3 w-full rounded-lg bg-neutral-900 py-3 text-sm font-medium text-white
                       transition-colors hover:bg-neutral-800
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Start
          </button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="mt-6 flex flex-wrap justify-center gap-1.5"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setTopic(suggestion)}
              className="rounded border border-neutral-200 px-2.5 py-1 text-[11px]
                         text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700"
            >
              {suggestion}
            </button>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
