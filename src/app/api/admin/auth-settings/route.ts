import { NextRequest, NextResponse } from "next/server";
import { getAuthSettings, updateAuthSettings, updatePasscodeLength } from "@/lib/authSettings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getAuthSettings();
    return NextResponse.json({
      passcodeLength: settings.passcodeLength,
      recoveryEmail: settings.recoveryEmail,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve auth settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { currentPasscode, newPasscode, newLength, changeLengthOnly } = body;

    if (!currentPasscode) {
      return NextResponse.json(
        { error: "Current passcode is required to make security changes." },
        { status: 400 }
      );
    }

    if (changeLengthOnly && (newLength === 4 || newLength === 6)) {
      const result = await updatePasscodeLength(currentPasscode, newLength);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: `Passcode mode updated to ${newLength} digits.` });
    }

    if (!newPasscode) {
      return NextResponse.json(
        { error: "New passcode is required." },
        { status: 400 }
      );
    }

    const targetLength = newLength === 4 ? 4 : 6;
    const result = await updateAuthSettings(currentPasscode, newPasscode, targetLength);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Passcode successfully updated (${targetLength} digits).`,
      passcodeLength: targetLength,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update auth settings" },
      { status: 500 }
    );
  }
}

