import type { CreateUnit } from "@/lib/types";
import { launchParams } from "./telegramIntegration";

export type ProfileId = CreateUnit<string, "profile-id">;
export type ProfileIdWithoutPrefix = CreateUnit<
  string,
  "profile-id-without-prefix"
>;

export const ProfileIdWithoutPrefixCheck = (
  id: string,
): id is ProfileIdWithoutPrefix => !id.startsWith("id");
export const ProfileIdAddPrefix = (id: string): ProfileId =>
  (id.startsWith("id") ? id : `id${id}`) as ProfileId;
export const ProfileIdRemovePrefix = (id: string): ProfileIdWithoutPrefix =>
  (id.startsWith("id") ? id.slice(2) : id) as ProfileIdWithoutPrefix;

export const isEqualIds = (a: string, b: string) => {
  const aStrip = a.slice(a.startsWith("id") ? 2 : 0);
  const bStrip = b.slice(b.startsWith("id") ? 2 : 0);

  return aStrip === bStrip;
};

export const getSelfUserId = () => {
  const id = launchParams.initData?.user?.id;
  if (!id) {
    throw new Error("Invalid user");
  }
  return id.toString() as ProfileIdWithoutPrefix;
};
