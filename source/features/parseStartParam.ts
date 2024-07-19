// https://github.com/joaquimserafim/base64-url/blob/54d9c9ede66a8724f280cf24fd18c38b9a53915f/index.js#L10
function unescapeBase64Url(str: string) {
  return (str + "===".slice((str.length + 3) % 4))

    .replace(/-/g, "+")

    .replace(/_/g, "/");
}

const decodeBase64Url = (str: string): string =>
  Buffer.from(unescapeBase64Url(str), "base64").toString();

export type StartParam =
  | {
      type: "board";
      data: string;
    }
  | {
      type: "note";
      data: {
        noteId: string;
        reversed: boolean;
      };
    };

const base64Prefix = "b64";
export const parseStartParam = (startParam: string): StartParam | null => {
  if (!startParam.startsWith(base64Prefix)) {
    return {
      type: "board",
      data: startParam,
    };
  }
  const content = (() => {
    try {
      return JSON.parse(
        decodeBase64Url(startParam.slice(base64Prefix.length)),
      ) as {
        noteId?: string;
        reversed?: boolean;
      };
    } catch (err) {
      console.error("failed to parse json", err);
      return null;
    }
  })();
  if (!content) {
    return null;
  }
  if (!content.noteId || typeof content.noteId !== "string") {
    console.error("unknown content", content);
    return null;
  }

  return {
    type: "note",
    data: {
      noteId: content.noteId,
      reversed: !!content.reversed,
    },
  };
};
