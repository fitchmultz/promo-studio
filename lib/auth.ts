import crypto from "node:crypto";
import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/config";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE_NAME = "promo_studio_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export const sessionCookieOptions = {
	httpOnly: true,
	sameSite: "lax" as const,
	secure:
		process.env.COOKIE_SECURE === "true" ||
		process.env.NODE_ENV === "production",
	maxAge: SESSION_MAX_AGE_SECONDS,
	path: "/",
};

const SessionPayloadSchema = z.object({
	userId: z.string().min(1),
	exp: z.number().int().positive(),
});

type SessionPayload = z.infer<typeof SessionPayloadSchema>;

function sign(payload: string) {
	return crypto
		.createHmac("sha256", env.SESSION_SECRET)
		.update(payload)
		.digest("base64url");
}

function encodeSession(payload: SessionPayload) {
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${body}.${sign(body)}`;
}

export function createSessionToken(userId: string) {
	return encodeSession({
		userId,
		exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
	});
}

function hasValidSignature(body: string, signature: string) {
	const expected = sign(body);
	const expectedBytes = Buffer.from(expected);
	const signatureBytes = Buffer.from(signature);
	return (
		expectedBytes.length === signatureBytes.length &&
		crypto.timingSafeEqual(expectedBytes, signatureBytes)
	);
}

function decodeSession(token: string | undefined): SessionPayload | null {
	if (!token) return null;
	const [body, signature] = token.split(".");
	if (!body || !signature || !hasValidSignature(body, signature)) return null;
	try {
		const parsed: unknown = JSON.parse(
			Buffer.from(body, "base64url").toString("utf8"),
		);
		const session = SessionPayloadSchema.safeParse(parsed);
		if (!session.success || session.data.exp < Date.now()) return null;
		return session.data;
	} catch {
		return null;
	}
}

export async function login(email: string, password: string) {
	const user = await prisma.user.findUnique({
		where: { email: email.toLowerCase().trim() },
	});
	if (!user) return null;
	const ok = await bcrypt.compare(password, user.passwordHash);
	if (!ok) return null;
	return user;
}

export async function logout() {
	const cookieStore = await cookies();
	cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function currentUser(): Promise<User | null> {
	const cookieStore = await cookies();
	const session = decodeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
	if (!session) return null;
	return prisma.user.findUnique({ where: { id: session.userId } });
}

export async function requireUser() {
	const user = await currentUser();
	if (!user) redirect("/login");
	return user;
}

export async function requireAdmin() {
	const user = await requireUser();
	if (user.role !== "admin") {
		redirect("/forbidden");
	}
	return user;
}
