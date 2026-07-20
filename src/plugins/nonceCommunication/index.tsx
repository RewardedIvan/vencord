import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { Message } from "@vencord/discord-types";
import { React } from "@webpack/common";

var injectedNonce = "";

export default definePlugin({
    name: "NonceCommunication",
    description: "NonceCommunication.",
    authors: [{ name: "int4_t", id: 723437187428778015n }],
    dependencies: ["MessageUpdaterAPI"],

    renderNonce: ErrorBoundary.wrap(({ message }: { message: Message; }) => {
        return <small>{message.nonce}</small>;
    }),

    renderInput: ErrorBoundary.wrap(() => {
        const [val, setVal] = React.useState("");
        return <input type="text" value={val} onChange={v => {
            const newv = (v.currentTarget as any).value;
            injectedNonce = newv;
            setVal(newv);
        }} />;
    }),

    injectNonce(original: any) {
        if (typeof original !== "number" || injectedNonce.length == 0) {
            return original;
        } else {
            return injectedNonce;
        }
    },

    patches: [
        // {
        //     find: /\w+\(\["MESSAGE_CREATE"\],/,
        //     replacement: {
        //         match: /(\w+)=>(\w+\.\w+\.loadGuildIds\(\[\w+\.guild_id\]\))/,
        //         replace: "$1=>{$1.embeds.secret_nonce = $1.nonce;/*console.log($1)*/;return $2;}",
        //     }
        // },
        {
            find: ".SEND_FAILED,",
            replacement: {
                match: /\.isFailed]:.+?children:\[/,
                replace: "$&$self.renderNonce(arguments[0]),"
            }
        },

        //{
        //    find: /className:\w+.channelBottomBarArea,children:.*?\}\),\w+=\(0,\w+\.jsx\)\("div",\{className:eJ\.channelBottomBarArea,children/,
        //    replacement: {
        //        match: /children:(\(.{0,500}announcementComposerEnabled:\w+\}\))\}\)/,
        //        replace: "children:[$self.renderInput(),$1]})"
        //    }
        //}
        //
        {
            find: /\w+\.jsxs\)\("form",\{ref:this\.inputFormRef,onSubmit:\w+,className:\w+\(\)\(\w+\.form,\{\[\w+\.formWithLoadedChatInput\]:!\w+\}\),children:\[\w+&&\(\w+,\w+\.jsx\)\(\w+\.\w+,\{channelId:\w+\.\w+\}\),\w+\.isPrivate\(\)\?\(\w+,\w+\.jsx\)\(\w+\.\w+,\{channel:\w+,children:\w+\}\):\(\w+,\w+\.jsx\)\(\w+\.\w+,\{channel:\w+,children:\w+\}\),\(\w+,\w+\.jsx\)\(\w+\.\w+,\{channel:\w+,isInTextChannel:!\w+\}\)\]/,
            replacement: {
                match: /(?<=formWithLoadedChatInput.{0,100}children:\[)(?=\w+&&.*channelId.*isPrivate)/,
                replace: "$&$self.renderInput(),"
            }
        },
        //{
        //    find: /handleSend\(\i,\i\)\{var \i;let\{channelId:\i,analyticsLocation:\i\}/,
        //    replacement: {
        //        match: /\((\i),(\i)\){(?=var \i;let\{channelId:\i,analyticsLocation:\i\})/,
        //        replace: "$&$self.injectIntoSend($1, this);"
        //    }
        //}
        //{
        //    find: /let \i=new\(\i\(\d+\)\)\.\i\("Queue"\);class \i{enqueue\(\i,\i,\i\)\{this\.queue\.push\(\{message:\i,/,
        //    replacement: {
        //        match: /(?<=let \i=new\(\i\(\d+\)\)\.\i\("Queue"\);class \i{enqueue\((\i),\i,\i\)\{)/,
        //        replace: "$self.injectIntoEnqueue($1);"
        //    }
        //}
        {
            find: /function \i\(\)\{let \i=Date\.now\(\);return \i!==\i&&\(\i\.reset\(\),\i=\i\),\i\.default\.fromTimestampWithSequence\(\i,\i\)\}/,
            replacement: {
                match: /(?<=function \i\(\)\{let \i=Date\.now\(\);return ).*?(?=})/,
                replace: "$self.injectNonce($&)"
            }
        }
    ],
});
