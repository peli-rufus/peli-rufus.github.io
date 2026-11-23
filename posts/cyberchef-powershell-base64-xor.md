---
id: cyberchef-powershell-base64-xor
title: "Malware Analysis Notes #01 — Decoding a PowerShell Stager with CyberChef"
date: 2026-11-23
tag: Malware Analysis
readTime: 12
views: 0
private: false
excerpt: "A practical CyberChef walkthrough extracting Base64-encoded PowerShell, reversing XOR, checking recovered shellcode and interpreting embedded network clues."
related:
  - cyberchef-aes-powershell-unpacking
  - iconcache-db-shared-folders-usb-evidence
---

*trojan.powershell/rozena*

**Techniques** · `Regex extraction` · `Base64 decoding` · `XOR decoding` · `Strings extraction` · `Hex inspection` · `Static x86 disassembly` · `SHA-256 verification`



## Analyzing an encoded PowerShell payload with CyberChef

This a beginner friendly walkthrough and here we analyze a PowerShell sample obtained from MalwareBazaar. Please not that the SHA-256 below identifies the PowerShell file, and the decoded payload has its own hash. You can download the sample from the following link. [MalwareBazaar sample download](https://bazaar.abuse.ch/download/5b7749150512cfe264aa3538dcbbda26a2e186bffed1cf638ddce050729f69ab/)

```javascript
SHA256:5b7749150512cfe264aa3538dcbbda26a2e186bffed1cf638ddce050729f69ab
```

Before we begin, search for the sample’s SHA-256 hash on VirusTotal. A hash lookup is a quick way to see whether the file has already been reported and review any detection names or other details that can guide our analysis. For a sample from a public repository like MalwareBazaar, this is a useful first step. We can search using the hash alone, since there’s no need to upload the file. Please treat any results as leads to verify during analysis.



To begin let us open the PowerShell sample in a text editor and search for `FromBase64String`. The long line it finds in the text editor is our starting point. By the end of the walkthrough, we’ll answer three questions.

1. How does the script hide the bytes it is designed to run?
2. How can we recover those bytes and check our work?
3. What network clues can we read from the recovered data?


We’ll use a text editor to read the script and an offline/online copy of **CyberChef** to transform the data. 


### Finding the encoded text

Look at the `FromBase64String('…')` call in the script. The long characters between the single quotes is Base64. Base64 represents bytes as printable characters, which lets the script carry binary data inside a line of text. Just below that line, the script loops through the resulting bytes and applies `-bxor 35`. Those two lines give us the order for our CyberChef recipe.



Let’s start by copying the entire PowerShell script into CyberChef’s **Input** pane. Search for **Regular expression** in the operations list and drag it into the empty **Recipe** pane.

Under **Built in regexes**, choose **User defined**. Paste the pattern below into the **Regex** field, then set **Output format** to **List matches**. That tells CyberChef to show you just the Base64 string it finds.

Check your settings against the screenshot below. If **Auto Bake** is off, click **Bake** to see your result.

```javascript
(?<=FromBase64String\(')[A-Za-z0-9+/]+={0,2}(?='\))
```

Now look at the **Output** pane. You should see a single Base64 string starting with `38uqIyMj`. The regex uses the single quotes to find where the string begins and ends, and **List matches** shows you just the text inside those quotes.


If you still see the entire script, switch **Output format** from **Highlight matches** to **List matches**. 




### Decoding the Base64

Now that we’ve pulled out the Base64 string, let’s turn it back into bytes. In CyberChef, drag **From Base64** below **Regular expression** and leave the alphabet at its default.

You’ll get **798 bytes**. If the output looks garbled, that’s expected. We’ve removed the Base64 layer, and the bytes are still masked by the script’s XOR operation. We’ll undo that next.



### Reversing the XOR operation

Let’s go back to the PowerShell script and look for `-bxor 35`. That line tells us the script uses `35` as the XOR key for every byte. To undo that change, we just apply XOR again with the same key.

In CyberChef, drag **XOR** below **From Base64**, choose **Decimal** as the key format, and enter `35`. That lets you use the number exactly as it appears in the script. If you prefer **HEX**, enter `23`. It’s the same key written in hexadecimal, so you’ll get the same output.

Most of the output looks garbled because CyberChef is displaying machine code as text. A few readable clues stand out. You can see `/wi1K`, the request path, just above the highlighted **User-Agent** header. The header contains browser details the payload is designed to send with its request. Near the bottom, the highlighted IP address `35[.]79[.]226[.]190` is the destination the code is designed to contact.

We can spot these clues in the raw output. Next, we’ll use **Strings** to make them easier to read.



### Finding readable strings

Now that we’ve reversed the XOR operation, let’s look for readable text in the decoded bytes. Add **Strings** directly below **XOR**. It scans the bytes for runs of printable characters, which can reveal clues like an IP address or a request path.

You’ll also see short fragments that don’t mean much on their own. **Strings** shows any run of printable characters that meets the minimum length, so even machine code can produce fragments that look like text.

Set the minimum length to **4**, then look at **Output**. You should see `/wi1K`, a `User-Agent` header, and `35[.]79[.]226[.]190` among the other fragments. A higher minimum can hide short clues like `/wi1K`, which is only five characters long.



### Viewing the decoded bytes in hex

We’ve seen the readable fragments. Now let’s look at the bytes themselves. Disable **Strings** and add **To Hex** below it. If **To Hex** is already there, enable it. Set **Delimiter** to **Space** and **Bytes per line** to **16**. With **Strings** disabled, **To Hex** receives the bytes from **XOR**. Compare the start of your output with the bytes below.

```txt
fc e8 89 00 00 00 60 89 e5 31 d2 64 8b 52 30
```

If your output starts with a different byte, check that **From Base64** comes before **XOR**. To see the readable fragments again, disable **To Hex** and re-enable **Strings**.



**What do the first bytes tell us?** Look at `FC E8 89 00 00 00` in CyberChef’s output. These bytes are the start of the decoded code. In 32-bit x86, `FC` tells the processor to read forward when it works through a string of bytes. The next instruction, `E8 89 00 00 00`, calls a routine farther down in the code, at offset `0x8F`.

You may see `FC E8 89` in detection rules for Cobalt Strike. Those three bytes give us a clue to follow. When we look farther into this sample, we find code designed to download another payload. That makes it a **stager**. We’d need more evidence to confirm that it’s Cobalt Strike.



### Looking for the request in the recovered bytes

Let’s put the strings we found into context. The request path, User-Agent, and IP address sit among 32-bit Windows instructions. The offsets below tell you where each clue starts in the decoded bytes.

| What you’ll see | What it tells us |
| --- | --- |
| `/wi1K` | The request path, stored at byte offset `0x143`. |
| A `User-Agent` containing `MSIE 10.0` and `Avant Browser` | The client description supplied by the code. It starts at `0x193`. |
| `35[.]79[.]226[.]190` | The embedded destination IP at `0x30c`. CyberChef shows ordinary dots. |

If you can see the IP address but can’t find `/wi1K`, check the minimum length in **Strings**. The path is only five characters long, so any setting above **5** filters it out. Set the minimum to **4** to bring it back into view.

The port takes a different kind of inspection. The code stores it as a number, so **Strings** won’t show it as the four characters `8080`. To find it, we look at the instructions that prepare the connection and read the number they pass as the port. That value is `0x1F90` in hexadecimal, which is **8080** in decimal.





> **Note:** 
Optional Step would be to use speakeasy and 1768.py



### Checking our work and answering the analysis questions

Let’s check our work by hashing the 798 bytes we recovered. In the screenshot below, we’ve already pasted the extracted Base64 into **Input**, so our recipe is **From Base64 → XOR → SHA2**. If we still have the full PowerShell script in **Input**, we’ll keep **Regular expression** at the start to extract the Base64. Let’s disable **Strings**, **To Hex**, or **Disassemble x86** if we added them, so **SHA2** gets the bytes directly from **XOR**.

In the screenshot, we’re using `23` in **HEX** for the XOR key. If we used `35` in **Decimal**, we can keep it. Both represent the same byte. In **SHA2**, let’s set **Size** to **256** and leave **Rounds** at **64**. Now let’s compare the 64-character hash in **Output** with the value below. If they match, we’ve recovered the same bytes. This hash identifies the decoded payload. The MalwareBazaar hash at the top identifies the PowerShell file.

```txt
9d49bf432a4872450b5e98d63102b0f7515467597375e3cfabc79efc8f1caeb5
```



1. **How does the script hide the bytes it is designed to run?** It stores XOR-masked bytes as Base64 text. When the script decodes that text, it applies XOR with decimal `35` to recover the bytes.
2. **How can we recover those bytes and check our work?** We extract the Base64 string, decode it, and apply XOR with the same key. The length and opening hex bytes give us quick checks. A matching SHA-256 confirms the result.
3. **What network clues can we read from the recovered data?** We can read the IP address `35[.]79[.]226[.]190` and the request path `/wi1K` in the decoded bytes. The instructions that set up the connection also give us TCP port **8080**. The code is designed to send an HTTP request and run the response from memory. That makes it a **stager**, a small piece of code that retrieves the next payload. We’d need network or endpoint evidence to know whether it ran, and more specific evidence to confirm Cobalt Strike.

If we want to go one step further, we can open the recovered bytes as raw **32-bit x86** in an offline disassembler. which is outside this walkthrough.
