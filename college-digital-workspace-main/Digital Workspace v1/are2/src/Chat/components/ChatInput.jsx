import React from 'react';

// ── Chat Input Component ────────────────────────────────────────
// Reusable sticky input footer for any chat channel.
// Uses <form> with onSubmit for proper submit behavior.

const ChatInput = ({ placeholder = 'Type a message...', showIcon = true, value, onChange, onSend, disabled = false, inputRef }) => {
    const isInteractive = typeof onChange === 'function';

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onSend && !disabled) {
            onSend();
        }
    };

    return (
        <div className="flex-shrink-0 px-6 py-4 border-t border-zinc-800">
            <form className="flex items-center gap-3" onSubmit={handleSubmit}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    value={isInteractive ? value : undefined}
                    onChange={isInteractive ? onChange : undefined}
                    readOnly={!isInteractive}
                    className="flex-1 bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-blue-500/60 transition-colors"
                />
                {showIcon ? (
                    <button
                        type="submit"
                        disabled={disabled}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl text-white transition-colors flex-shrink-0 ${disabled
                            ? 'bg-zinc-700 cursor-not-allowed opacity-50'
                            : 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                            }`}
                    >
                        ➤
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={disabled}
                        className={`px-5 py-2.5 text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0 ${disabled
                            ? 'bg-zinc-700 cursor-not-allowed opacity-50'
                            : 'bg-blue-600 hover:bg-blue-500 cursor-pointer'
                            }`}
                    >
                        Send
                    </button>
                )}
            </form>
        </div>
    );
};

export default ChatInput;
