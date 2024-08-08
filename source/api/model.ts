import type { DateString } from "@/features/format";
import type { ProfileIdWithoutPrefix } from "@/features/idUtils";

export type ContentAuthor = {
  id: ProfileIdWithoutPrefix;
  name: string;
  photo: string;
};

export type Note = {
  id: string;
  type: "private" | "public" | "public-anonymous";
  author?: ContentAuthor;
  createdAt: DateString;
  content: string;
};
export type NoteWithComment = Note & {
  lastComment?: Omit<Comment, "createdAt">;
  commentsCount: number;
};

export type NoteArray = {
  next?: string;
  data: NoteWithComment[];
};

export type BoardProfile = {
  photo?: string;
  title: string;
  description?: string;
};

export type Board = {
  id: ProfileIdWithoutPrefix;
  isme: boolean;
  name?: string;
  profile?: BoardProfile;
};

export type Wallet = {
  address: string;
  friendlyAddress: string;
  tokens: {
    yo: string;
  };
};

export type WalletConfirmation = {
  address: string;
  proof: {
    timestamp: number;
    domain: {
      value: string;
      lengthBytes: number;
    };
    signature: string;
    payload: string;
  };
  stateInit: string;
  publicKey: string;
};

export type Error = {
  error: {
    message: string;
  };
};

// right now wallet error cannot be thrown - only errors that backend return - is limit errors
export type WalletError = {
  error: {
    reason: "insufficient_balance" | "no_connected_wallet";
    payload: {
      requiredBalance: string;
    };
  };
};

/**
 * @description limit errors are only possible now with private comments
 */
export type LimitReachedError = {
  error: {
    reason: "reached_limit";
    payload: {
      source: WalletError["error"];
      limit: number;
      limitResetAt: DateString;
    };
  };
};

export type Comment = {
  id: string;
  content: string;
  type: "public" | "anonymous";
  createdAt: DateString;
  author?: ContentAuthor;
};

export type CreateCommentRequest = {
  noteID: string;
  content: string;
  /**
   * @description undefined should be used for comments on private notes
   */
  type: Comment["type"] | undefined;
};
