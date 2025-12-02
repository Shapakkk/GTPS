import { Command } from "../Command";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { ROLE, ActionTypes, LOCKS } from "@growserver/const";
import { Variant } from "growtopia.js";
import { DialogBuilder } from "@growserver/utils";
import { type NonEmptyObject } from "type-fest";
import { World } from "../../core/World";

// ==========================================
// BAGIAN 1: COMMAND (/clearworld)
// ==========================================
export default class ClearWorld extends Command {
  constructor(
    public base: Base,
    public peer: Peer,
    public text: string,
    public args: string[],
  ) {
    super(base, peer, text, args);
    this.opt = {
      command:     ["clearworld", "cw"],
      description: "Clear a world",
      cooldown:    10,
      ratelimit:   1,
      category:    "`bDev", // Ubah kategori jadi Dev
      usage:       "/clearworld",
      example:     ["/clearworld"],
      permission:  [ROLE.DEVELOPER], // PERUBAHAN: Hanya Developer yang bisa
    };
  }

  public async execute(): Promise<void> {
    // Karena sekarang KHUSUS Developer, kita tidak perlu cek ownerID ketat
    // Dev bebas clear world manapun.
    
    // Tampilkan Dialog Konfirmasi
    const dialog = new DialogBuilder()
      .defaultColor()
      .addLabelWithIcon("Warning", "1432", "big")
      .addTextBox(
        "This will clear everything on your world, including your building. Are you sure?",
      )
      .endDialog("confirm_clearworld", "Nevermind", "Yes")
      .str();

    this.peer.send(Variant.from("OnDialogRequest", dialog));
  }
}

// ==========================================
// BAGIAN 2: DIALOG HANDLER (Eksekusi)
// ==========================================
export class ConfirmClearWorld {
  private world: World;

  constructor(
    public base: Base,
    public peer: Peer,
    public action: NonEmptyObject<{
      dialog_name: string;
    }>,
  ) {
    this.world = this.peer.currentWorld()!;
  }

  public async execute(): Promise<void> {
    if (!this.action.dialog_name) return;
    
    // Double check permission saat eksekusi (Safety)
    if (this.peer.data.role !== ROLE.DEVELOPER) return;

    // 1. Loop semua block untuk dibersihkan
    for (let i = 0; i < this.world.data.blocks.length; i++) {
      const b = this.world.data.blocks[i];
      const fg = b.fg || 0;
      const bg = b.bg || 0;
      
      // Skip block kosong biar cepat
      if (fg === 0 && bg === 0) continue;

      const itemMeta = this.base.items.metadata.items.get((fg || bg).toString());
      if (!itemMeta) continue;

      const mLock = LOCKS.find((l) => l.id === itemMeta.id);

      // JANGAN HAPUS: Main Door (6), Bedrock (8), atau Lock Utama (WL/SL/BL)
      if (
        fg === 6 ||
        fg === 8 ||
        (!mLock && itemMeta.type === ActionTypes.LOCK)
      ) continue;

      // Hapus properti blok
      Object.keys(b).forEach((v) => {
        if (v === "x" || v === "y") {
          // Koordinat jangan dihapus
        } else if (v === "fg" || v === "bg") {
          b[v] = 0; // Set jadi udara
        } else {
          // @ts-expect-error dynamic assignment
          b[v] = undefined; // Hapus properti lain (sign, door, dll)
        }
      });
    }

    // 2. Bersihkan Item yang Jatuh (Dropped Items)
    this.world.data.dropped = { uid: 0, items: [] };

    // 3. FORCE SAVE KE DATABASE
    await this.world.saveToCache();
    await this.world.saveToDatabase();

    this.peer.send(
      Variant.from("OnConsoleMessage", "`2World cleared successfully!``")
    );

    // 4. Kick semua player agar world ter-reload bersih
    const world = this.peer.currentWorld();
    if (world) {
      world.every((p) => {
        p.leaveWorld();
      });
    }
  }
}