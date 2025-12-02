import { Command } from "../Command";
import { Base } from "../../core/Base";
import { Peer } from "../../core/Peer";
import { ROLE } from "@growserver/const";
import { Variant } from "growtopia.js";
import { CommandMap } from ".";
import { DialogBuilder } from "@growserver/utils";

export default class Help extends Command {
  constructor(base: Base, peer: Peer, text: string, args: string[]) {
    super(base, peer, text, args);
    this.opt = {
      command: ["help", "?"],
      description: "Shows available commands separated by role",
      cooldown: 5,
      ratelimit: 1,
      category: "`oBasic",
      usage: "/help",
      example: ["/help"],
      permission: [ROLE.BASIC, ROLE.SUPPORTER, ROLE.DEVELOPER],
    };
  }

  private getRoleLevel(role: string): number {
    const roleLevels = {
      [ROLE.BASIC]: 1,
      [ROLE.SUPPORTER]: 2,
      [ROLE.DEVELOPER]: 3,
    };
    return roleLevels[role] || 0;
  }

  public async execute(): Promise<void> {
    // 1. Jika player mengetik /help <command>, tampilkan dialog detail
    if (this.args.length > 0) {
      const cmdName = this.args[0].toLowerCase();
      const Class = CommandMap[cmdName];

      if (!Class) {
        this.peer.send(
          Variant.from(
            "OnConsoleMessage",
            "It seems that commands doesn't exist.",
          ),
        );
        return;
      }

      const cmd = new Class(this.base, this.peer, this.text, this.args);
      const dialog = new DialogBuilder()
        .defaultColor()
        .addLabelWithIcon(cmdName, "32", "small")
        .addSpacer("small")
        .addSmallText(`Description: ${cmd?.opt.description}`)
        .addSmallText(`Cooldown: ${cmd?.opt.cooldown}`)
        .addSmallText(`Ratelimit: ${cmd?.opt.ratelimit}`)
        .addSmallText(
          `Permissions: ${cmd?.opt.permission.length ? cmd.opt.permission : "None"}`,
        )
        .addSmallText(`Usage: ${cmd?.opt.usage}`)
        .addSmallText(`Example: ${cmd?.opt.example.join(", ")}`)
        .endDialog("help_end", "", "Ok")
        .addQuickExit();
      return this.peer.send(Variant.from("OnDialogRequest", dialog.str()));
    }

    // 2. Logic Baru: Memisahkan Command berdasarkan Role
    const userRoleLevel = this.getRoleLevel(this.peer.data.role);

    // Siapkan wadah (array) untuk setiap role
    const basicCmds: string[] = [];
    const supporterCmds: string[] = [];
    const developerCmds: string[] = [];

    Object.values(CommandMap).forEach((CommandClass) => {
      const cmd = new CommandClass(this.base, this.peer, "", []);

      // Cek apakah player PUNYA akses ke command ini
      const hasPermission = cmd.opt.permission.some(
        (role) => this.getRoleLevel(role) <= userRoleLevel,
      );

      if (hasPermission) {
        // PERUBAHAN DISINI: Tidak pakai tanda "/" lagi
        const cmdName = cmd.opt.command[0];

        // Tentukan command ini masuk kategori role yang mana
        if (cmd.opt.permission.includes(ROLE.BASIC)) {
          basicCmds.push(cmdName);
        } else if (cmd.opt.permission.includes(ROLE.SUPPORTER)) {
          supporterCmds.push(cmdName);
        } else if (cmd.opt.permission.includes(ROLE.DEVELOPER)) {
          developerCmds.push(cmdName);
        }
      }
    });

    // Urutkan abjad biar rapi
    basicCmds.sort();
    supporterCmds.sort();
    developerCmds.sort();

    // 3. Kirim pesan terpisah
    if (basicCmds.length > 0) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          `\`oBasic Commands: \`w${basicCmds.join(", ")}`,
        ),
      );
    }

    if (userRoleLevel >= 2 && supporterCmds.length > 0) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          `\`9Supporter Commands: \`w${supporterCmds.join(", ")}`,
        ),
      );
    }

    if (userRoleLevel >= 3 && developerCmds.length > 0) {
      this.peer.send(
        Variant.from(
          "OnConsoleMessage",
          `\`bDeveloper Commands: \`w${developerCmds.join(", ")}`,
        ),
      );
    }
  }
}