import * as React from 'react';

/** WBR adds path breaks without adding or removing any identity characters. */
export function mapLabel(name: string): React.ReactNode {
    const parts = name.split(/(?<=[/\\._:-])/u);
    return parts.map((part, index) => React.createElement(React.Fragment, { key: index }, part,
        index < parts.length - 1 ? React.createElement('wbr') : null));
}
