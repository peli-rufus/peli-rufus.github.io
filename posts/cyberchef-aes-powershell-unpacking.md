---
id: cyberchef-aes-powershell-unpacking
title: "Malware Analysis Notes #02 — Unpacking an AES-Protected PowerShell Payload with CyberChef"
date: 2026-11-23
tag: Malware Analysis
readTime: 18
views: 0
private: false
excerpt: "Follow AES-CBC decryption, repeating-key XOR and Base64 layers to recover and verify two embedded Windows PE files."
related:
  - cyberchef-powershell-base64-xor
  - iconcache-db-shared-folders-usb-evidence
---

## Malware Analysis Notes #02 — Unpacking an AES-Protected PowerShell Payload with CyberChef

In our first walkthrough, we used Base64 decoding and XOR to recover a PowerShell payload. This time, we’ll work through an AES-encrypted layer, follow a repeating XOR key, and recover two embedded Windows executables.

Please note that we’ll use a text editor and CyberChef. So keep the script open as text as we work. Every transformation below operates on data. If **Auto Bake** is off, click **Bake** after changing the recipe.

By the end, we’ll be able to answer three questions.

1. Where does the script get its AES key and IV, and how do we use them?
2. How do we recover and verify both embedded files?
3. What can we establish from the PowerShell, and what still needs further inspection?

**Techniques** · `Regex extraction` · `Base64 decoding` · `SHA-256 verification` · `AES-CBC decryption` · `Repeating-key XOR` · `Decimal byte conversion` · `PE identification`

Our starting file SHA-256 identifies the original PowerShell script.

```txt
3404ac2243b8e4d9c81f7f8c3c1b00163bc48752437e47ca34ea076ea3437e4a
```

### Extracting the first layer

Let’s paste the entire original script into CyberChef’s **Input** pane. Search for **Regular expression**, drag it into the empty **Recipe**, and select **User defined**. Paste the pattern below into **Regex**, then choose **List matches**.

```javascript
(?<=\$encryptedPayload\s*=\s*@'\r?\n)[\s\S]*?(?=\r?\n'@)
```

The pattern finds the text assigned to `$encryptedPayload` between the PowerShell here-string markers `@'` and `'@`. The `[\s\S]*?` part lets us capture text across multiple lines. **List matches** gives us just the captured Base64, beginning with `A8wz7MUOrEvKTN7`.



### Turning Base64 into encrypted bytes

Now let’s add **From Base64** below the regex and keep the default alphabet. Leave **Remove non-alphabet chars** enabled so the line breaks are ignored. We should recover **1,874,832 bytes**.

In the screenshot below, the extracted Base64 has been copied into **Input** in a separate tab, so the recipe starts with **From Base64**. We can also keep the original script in Input and leave the extraction regex above it.

The output looks garbled because these are encrypted bytes. Let’s go back to the script to find out how to decrypt them.



### Following the payload variable

In our text editor, look at the large block assigned to `$encryptedPayload`. The `@'` and `'@` markers let PowerShell hold text across multiple lines. The variable name points us toward encryption, but we’ll follow how the code uses it to choose our next operation.



### Finding the key, IV, and expected fingerprint

Scroll toward the end of the original script. We’ll find `$cryptoKeyMaterial`, `$initializationVector`, and `$payloadFingerprint`.

The function `ConvertFrom-EncodedBlob` strips whitespace, normalizes the Base64 alphabet, and calls `FromBase64String`. The execution section passes all four values through that function. That tells us the payload, key, IV, and fingerprint are stored as Base64.

The AES function also sets **CBC** mode and **PKCS7** padding. Those settings come directly from the code. The fingerprint is the expected SHA-256 of the encrypted bytes. Let’s check that first.



### Calculating the ciphertext fingerprint

Return to the recipe that extracts `$encryptedPayload`. Add **SHA2** after **From Base64**, set **Size** to **256**, and leave **Rounds** at **64**.

We’re hashing the encrypted bytes at this point. Our output should be:

```txt
2fdb472ffcbbf8f0f5cdc2d3c38602813fa033a11fe96f9a6526dd245306f6c0
```

Next, we’ll decode the expected fingerprint from the script and compare the two.



### Decoding the expected fingerprint

In a fresh tab, paste only the value inside `$payloadFingerprint`.

```txt
L9tHL/y7+PD1zcLTw4YCgT+gM6Ef6W+aZSbdJFMG9sA=
```

Add **From Base64 → To Hex**. Base64 decoding gives us hash bytes. **To Hex** displays each byte as two readable characters. The screenshot uses spaces between the bytes. We can set **Delimiter** to **None** to compare the result directly with the 64-character hash above.

The values should match. The script performs this same comparison and stops if the ciphertext differs. This checks consistency with the fingerprint stored in the script. Someone changing the script could replace both values, so a match alone doesn’t establish trust.



### Recovering the AES key

Let’s open another tab and paste the value from `$cryptoKeyMaterial`.

```txt
w6udwh4T25U5DoGjM1fRJHhXWmDDSKGWrQlGbNFKnlg=
```

Add **From Base64 → To Hex**. The first operation recovers the key’s** bytes**. Some bytes don’t display as readable text, so **To Hex** gives us a representation we can copy reliably into the AES key field.

Each byte becomes two hex characters. Set **Delimiter** to **None** to get this continuous 64-character value. The screenshot shows the same bytes with spaces.

```txt
c3ab9dc21e13db95390e81a33357d12478575a60c348a196ad09466cd14a9e58
```

When we paste this into **AES Decrypt** and choose **HEX**, CyberChef converts the text back into those same key bytes. The key is 32 bytes × 8 bits, which gives us **AES-256**.



### Recovering the initialization vector

Now let’s repeat the process for `$initializationVector`. Paste its value into a fresh tab.

```txt
HIULVyT3lXkRSJTG9epBlA==
```

Apply **From Base64 → To Hex**, with **Delimiter** set to **None**. We should get:

```txt
1c850b5724f79579114894c6f5ea4194
```

This is **16 bytes**, displayed as 32 hex characters. AES-CBC uses the IV as the starting value when processing the first block. We’ll select **HEX** beside the IV field when we paste it into **AES Decrypt**.



### Decrypting the AES layer

Return to our payload recipe and remove the temporary **SHA2** operation. Add **AES Decrypt** after **From Base64**.

Paste the recovered key and IV into their fields and choose **HEX** for both. Set **Mode** to **CBC**, **Input** to **Raw**, **Output** to **Raw**, and **IV from input** to **Off**. If our version of CyberChef exposes a padding option, choose **PKCS7**.

The key and IV formats describe how we entered those values. AES **Input** describes the ciphertext coming from the previous operation. Since **From Base64** already gives us bytes, we choose **Raw**. The screenshot shows those ciphertext bytes copied into a fresh tab, where **AES Decrypt** is the only operation.

Our output should be readable PowerShell, **1,874,825 bytes** long, beginning with comments about a **Stage-One Unpacker**. The seven-byte difference from the ciphertext is the removed PKCS7 padding.

For an additional/optional check, temporarily add **SHA2**, size **256**, after AES. The decrypted script’s SHA-256 should be:

```txt
a32eacdfc1009db649da7bd7a403804426e33ee59bdcb74424a66cc84a769980
```

Disable SHA2 again before copying the decrypted PowerShell into a text editor and a new CyberChef tab.



### Reading the next decoding sequence

Search the decrypted script for `$blob`. We’ll find another long Base64 string followed by a call to `ConvertFrom-ObfuscatedPayload`.

Inside that function, the code first Base64-decodes the data, then XORs it with a repeating key. The line assigning `$assemblyBytes` applies Base64 decoding again to the function’s output. This gives us the next sequence to reproduce.

**Extract \$blob → From Base64 → XOR → From Base64**

We can also see `$extraData` below it. That’s a separate byte array we’ll return to after recovering the first file.



### Extracting and decoding the inner blob

With the decrypted PowerShell in our new tab’s **Input**, add **Regular expression**, select **User defined**, and use this pattern with **List matches**.

```javascript
(?<=\$blob\s*=\s*')[A-Za-z0-9+/]+={0,2}(?=')
```

We should extract** characters**, starting with `Bx0QFSA7`. Add **From Base64** below the regex. The output is now **83,288 bytes**. It still looks garbled because we haven’t reversed XOR yet.



### Getting the XOR key from the script

Search the decrypted PowerShell for `$xorSecret`. We’ll find:

```powershell
$xorSecret = "SKaDazKA6@@^^"
```

The decoding function uses `UTF8.GetBytes($MaskKey)` to turn that text into key bytes. Its loop selects a key byte using `$pos % $maskLength`, which repeats the key when it reaches the end.

That gives us both the key and its format. We’ll enter it as **UTF8** in CyberChef and copy the capitalization and punctuation exactly.



### Reversing the repeating XOR

Add **XOR** after the inner **From Base64** operation. Choose **UTF8** as the key format and enter:

```txt
SKaDazKA6@@^^
```

Keep **Standard** selected and **Null preserving** unchecked. The screenshot shows the already Base64-decoded bytes copied into Input, so XOR is the only operation there.

Our output should become readable Base64, starting with `TVqQAAMAAAAEAAAA`. It is still **83,288 bytes** long because XOR changes each byte without changing the count. CyberChef may suggest **From Base64**. We can confirm that next step from the script’s `FromBase64String($unwrapped)` call.



### Recovering the first Windows executable

Add one more **From Base64** after **XOR**. We should now have **62,464 bytes**.

In the output, look for `MZ`, `This program cannot be run in DOS mode`, and section names such as `.text` and `.rsrc`. These are familiar PE-file structures. The `MZ` opening corresponds to hex bytes `4D 5A`. Inspection also confirms a PE signature at offset `0x80`.

The DOS message is embedded text in the file. We’re seeing it while displaying the bytes. It doesn’t indicate that the file was run.



### Verifying the first recovered file

Add **SHA2** directly after the final **From Base64**, with **Size 256** and **Rounds 64**. Disable any display operations such as **Strings** or **To Hex** before hashing. We should get:

```txt
6f5e5b62d1048251c1141402fdb3e941d21c51b3b91584495d002ced29f6259a
```

A match confirms we recovered the same 62,464-byte file. To save its raw bytes, disable SHA2 and use **Save output to file**. We can call it `recovered-assembly.bin`.



### Extracting the second embedded file

Let’s return to the AES-decrypted PowerShell. Search for `[byte[]]$extraData`. Its value starts with `77,90,144,0`. Each comma-separated decimal number represents one byte.

Paste the decrypted script into another CyberChef tab. Add **Regular expression**, select **List matches**, and use:

```javascript
(?<=\[byte\[\]\]\$extraData\s*=\s*\()[\d,\s]+(?=\))
```

This gives us the numbers inside the parentheses, ready to convert. The surrounding code groups `$extraData` and the `aspnet_compiler.exe` path into arguments for the first assembly’s `LAUNCHER` method.



### Converting decimal numbers into bytes

Add **From Decimal** after the regex and choose **Comma** as the delimiter. In the screenshot, the extracted numbers have been copied into Input in a separate tab.

Decimal `77` becomes byte `4D`, and decimal `90` becomes byte `5A`. Together they spell `MZ`. We should recover **537,600 bytes**, with another DOS message and PE section names visible. A PE signature is present at offset `0x110`.

This recovers the executable represented by the array. The PowerShell passes these bytes directly to the first assembly.



### Verifying the second file and checking our findings

Add **SHA2** directly after **From Decimal**, set **Size** to **256**, and leave **Rounds** at **64**. We should get:

```txt
3d53122ffd7a9b307903d70106d2ab12d3cd319ce4b911a5bd7198dd5660a6e6
```

This hash identifies the second recovered file. Disable SHA2 before saving the raw output as `recovered-extra-data.bin`.



### What have we established?

Let’s return to our opening questions.

1. **Where did we get the AES key and IV?** Both were stored as Base64 in the original script. We decoded them and used **To Hex** to make their bytes easy to copy into the AES fields. The script supplied CBC mode and PKCS7 padding.
2. **How did we recover and verify both files?** After AES decryption, we followed the inner Base64 and repeating XOR sequence to recover the first PE file. We converted the separate decimal array into the second PE file. The full SHA-256 values above let us check each result.
3. **What does the PowerShell tell us?** Once we’ve decoded the files, we can see how the script connects them. It is designed to load the first recovered file into memory and call its `LAUNCHER` method inside `FILED.WHORE`. It passes that method two things which are the path to `aspnet_compiler.exe` and the bytes of the second executable.

Before making that call, the script checks whether a process named `aspnet_compiler` is running. If it is, the script waits five seconds and checks again. When the process is absent, it proceeds with the call.

We’ve now worked through the AES, Base64, and XOR layers, recovered two executable files, and verified their hashes. We’ve also found where the PowerShell hands control to the first assembly. Understanding what happens next would require inspecting that assembly’s protected code.
