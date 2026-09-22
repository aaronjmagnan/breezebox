import { Fragment } from 'react';
import { parseBlocks, parseInline } from '@/lib/markup';

/**
 * The answer, rendered. The parsing lives in @/lib/markup so it can be tested;
 * this file is only the mapping from blocks and tokens to elements.
 */
export function Answer({ text, citationCount }: { text: string; citationCount: number }) {
  return (
    <div className="flex flex-col gap-3">
      {parseBlocks(text).map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <h3 key={index} className="mt-2 text-base font-semibold text-bb-text">
              <Inline text={block.text} count={citationCount} />
            </h3>
          );
        }

        if (block.kind === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List
              key={index}
              className={`ml-5 flex flex-col gap-2 ${
                block.ordered ? 'list-decimal' : 'list-disc'
              }`}
            >
              {block.items.map((item, i) => (
                <li key={i} className="text-base leading-relaxed text-bb-text">
                  <Inline text={item} count={citationCount} />
                </li>
              ))}
            </List>
          );
        }

        return (
          <p key={index} className="text-base leading-relaxed text-bb-text">
            <Inline text={block.text} count={citationCount} />
          </p>
        );
      })}
    </div>
  );
}

function Inline({ text, count }: { text: string; count: number }) {
  return (
    <>
      {parseInline(text, count).map((token, index) => {
        if (token.kind === 'bold') {
          return (
            <strong key={index} className="font-semibold">
              {token.text}
            </strong>
          );
        }

        if (token.kind === 'citation') {
          return (
            <sup key={index} className="whitespace-nowrap">
              {token.refs.map((ref, i) => (
                <Fragment key={ref}>
                  {i > 0 ? <span className="text-bb-muted">,</span> : null}
                  <a
                    href={`#source-${ref}`}
                    className="px-0.5 font-semibold text-accent-blue-ink underline underline-offset-2"
                  >
                    {ref}
                  </a>
                </Fragment>
              ))}
            </sup>
          );
        }

        return <Fragment key={index}>{token.text}</Fragment>;
      })}
    </>
  );
}
