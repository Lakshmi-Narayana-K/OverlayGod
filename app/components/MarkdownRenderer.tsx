import React, { memo, useState, useEffect } from 'react'
import { Clipboard } from 'lucide-react'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
// Use ESM imports and a working theme
import { materialOceanic } from 'react-syntax-highlighter/dist/esm/styles/prism'
import 'katex/dist/katex.min.css'

const CodeBlock: React.FC<{
  node?: object
  inline?: boolean
  className?: string
  children?: React.ReactNode
}> = ({ node: _node, inline, className, children, ...props }) => {
  const [hasMounted, setHasMounted] = React.useState(false)
  const [copied, setCopied] = useState(false)
  const [languagesLoaded, setLanguagesLoaded] = useState(false)


  React.useEffect(() => {
    setHasMounted(true)

    // Dynamic language loading
    const loadLanguages = async () => {
      try {
        const [tsx, typescript, javascript, markdown, json, css, python, java] = await Promise.all([
          import('react-syntax-highlighter/dist/esm/languages/prism/tsx'),
          import('react-syntax-highlighter/dist/esm/languages/prism/typescript'),
          import('react-syntax-highlighter/dist/esm/languages/prism/javascript'),
          import('react-syntax-highlighter/dist/esm/languages/prism/markdown'),
          import('react-syntax-highlighter/dist/esm/languages/prism/json'),
          import('react-syntax-highlighter/dist/esm/languages/prism/css'),
          import('react-syntax-highlighter/dist/esm/languages/prism/python'),
          import('react-syntax-highlighter/dist/esm/languages/prism/java'),
        ])

        SyntaxHighlighter.registerLanguage('tsx', tsx.default)
        SyntaxHighlighter.registerLanguage('typescript', typescript.default)
        SyntaxHighlighter.registerLanguage('javascript', javascript.default)
        SyntaxHighlighter.registerLanguage('js', javascript.default)
        SyntaxHighlighter.registerLanguage('markdown', markdown.default)
        SyntaxHighlighter.registerLanguage('json', json.default)
        SyntaxHighlighter.registerLanguage('css', css.default)
        SyntaxHighlighter.registerLanguage('python', python.default)
        SyntaxHighlighter.registerLanguage('java', java.default)

        setLanguagesLoaded(true)
      } catch (error) {
        console.error('Failed to load syntax highlighting languages:', error)
        setLanguagesLoaded(true) // Still allow rendering
      }
    }

    loadLanguages()
  }, [])

  if (!hasMounted) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const match = /language-(\w+)/.exec(className || '')
  console.log(languagesLoaded, match?.[1], 'languagesLoaded')

  return !inline && match ? (
    <div className="relative rounded-md overflow-hidden my-4 shadow-md">
      <div className="flex justify-between items-center bg-gray-800 px-4 py-2 text-gray-400 text-xs font-mono rounded-t-md">
        <span>{match[1].toUpperCase()}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors duration-200"
        >
          <Clipboard size={14} />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="overflow-auto custom-scrollbar">
        <SyntaxHighlighter
          style={materialOceanic}
          language={languagesLoaded ? match[1] : 'text'}
          PreTag="div"
          customStyle={{
            margin: 0,
            paddingTop: 0,
            borderBottomLeftRadius: '0.375rem',
            borderBottomRightRadius: '0.375rem',
          }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    </div>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

// Remove the custom codeTheme object completely

interface MarkdownRendererProps {
  content: string
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) {
    return null // Return null for empty content
  }

  return (
    <div className="markdown-body">
      <Markdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code: CodeBlock,
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}

export default memo(MarkdownRenderer)
