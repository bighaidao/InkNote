use serde::Serialize;

#[derive(Clone, Default, Serialize)]
pub struct AiDelta {
    pub text: String,
    pub reasoning: String,
}

#[derive(Default)]
pub struct StreamParser {
    pending: Vec<u8>,
    data: Vec<String>,
    pub text: String,
    pub done: bool,
}

impl StreamParser {
    pub fn push(
        &mut self,
        bytes: &[u8],
        protocol: &str,
        send: &mut impl FnMut(AiDelta),
    ) -> Result<(), String> {
        self.pending.extend_from_slice(bytes);
        while let Some(end) = self.pending.iter().position(|byte| *byte == b'\n') {
            let line = self.pending.drain(..=end).collect::<Vec<_>>();
            let line = std::str::from_utf8(&line)
                .map_err(|_| "ai_response_invalid")?
                .trim_end_matches(['\r', '\n']);
            if line.is_empty() {
                self.event(protocol, send)?;
            } else if let Some(data) = line.strip_prefix("data:") {
                self.data
                    .push(data.strip_prefix(' ').unwrap_or(data).to_owned());
            }
        }
        if self.pending.len() > 1_048_576 {
            return Err("ai_response_invalid".into());
        }
        Ok(())
    }

    pub fn finish(
        &mut self,
        protocol: &str,
        send: &mut impl FnMut(AiDelta),
    ) -> Result<String, String> {
        self.push(b"\n\n", protocol, send)?;
        if !self.done {
            return Err("ai_response_incomplete".into());
        }
        if self.text.trim().is_empty() {
            return Err("ai_response_empty".into());
        }
        Ok(self.text.trim().to_owned())
    }

    fn event(&mut self, protocol: &str, send: &mut impl FnMut(AiDelta)) -> Result<(), String> {
        if self.data.is_empty() {
            return Ok(());
        }
        let data = std::mem::take(&mut self.data).join("\n");
        if data == "[DONE]" {
            self.done = true;
            return Ok(());
        }
        let value: serde_json::Value =
            serde_json::from_str(&data).map_err(|_| "ai_response_invalid")?;
        if value.get("error").is_some() {
            return Err("ai_response_invalid".into());
        }
        let mut delta = AiDelta::default();
        match protocol {
            "anthropic" => {
                delta.text = value
                    .pointer("/delta/text")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .into();
                delta.reasoning = value
                    .pointer("/delta/thinking")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .into();
                if value["type"] == "content_block_start" {
                    delta.text = value
                        .pointer("/content_block/text")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .into();
                    delta.reasoning = value
                        .pointer("/content_block/thinking")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .into();
                }
                if value.pointer("/delta/stop_reason").and_then(|v| v.as_str())
                    == Some("max_tokens")
                {
                    return Err("ai_response_incomplete".into());
                }
                self.done |= value["type"] == "message_stop";
            }
            "gemini" => {
                if let Some(parts) = value
                    .pointer("/candidates/0/content/parts")
                    .and_then(|v| v.as_array())
                {
                    for part in parts {
                        let text = part["text"].as_str().unwrap_or_default();
                        if part["thought"] == true {
                            delta.reasoning.push_str(text);
                        } else {
                            delta.text.push_str(text);
                        }
                    }
                }
                if let Some(reason) = value
                    .pointer("/candidates/0/finishReason")
                    .and_then(|v| v.as_str())
                {
                    if reason != "STOP" {
                        return Err("ai_response_incomplete".into());
                    }
                    self.done = true;
                }
            }
            _ => {
                delta.text = value
                    .pointer("/choices/0/delta/content")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .into();
                delta.reasoning = value
                    .pointer("/choices/0/delta/reasoning_content")
                    .or_else(|| value.pointer("/choices/0/delta/reasoning"))
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .into();
                if let Some(reason) = value
                    .pointer("/choices/0/finish_reason")
                    .and_then(|v| v.as_str())
                {
                    if reason != "stop" {
                        return Err("ai_response_incomplete".into());
                    }
                    self.done = true;
                }
            }
        }
        self.text.push_str(&delta.text);
        if !delta.text.is_empty() || !delta.reasoning.is_empty() {
            send(delta);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_split_utf8_crlf_and_separate_reasoning() {
        let input = "data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"思考\"}}]}\r\n\r\ndata: {\"choices\":[{\"delta\":{\"content\":\"正文\"}}]}\n\ndata: [DONE]\n\n";
        let mut parser = StreamParser::default();
        let mut events = Vec::new();
        for byte in input.as_bytes() {
            parser
                .push(&[*byte], "openai", &mut |v| events.push(v))
                .unwrap();
        }
        assert_eq!(parser.finish("openai", &mut |_| {}).unwrap(), "正文");
        assert_eq!(events[0].reasoning, "思考");
        assert_eq!(events[1].text, "正文");
    }

    #[test]
    fn rejects_truncated_streams() {
        let mut parser = StreamParser::default();
        parser
            .push(
                b"data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n",
                "openai",
                &mut |_| {},
            )
            .unwrap();
        assert_eq!(
            parser.finish("openai", &mut |_| {}).unwrap_err(),
            "ai_response_incomplete"
        );
    }

    #[test]
    fn handles_anthropic_and_gemini_events() {
        for (protocol, input) in [
            ("anthropic", "data: {\"delta\":{\"thinking\":\"reason\"}}\n\ndata: {\"delta\":{\"text\":\"answer\"}}\n\ndata: {\"type\":\"message_stop\"}\n\n"),
            ("gemini", "data: {\"candidates\":[{\"content\":{\"parts\":[{\"thought\":true,\"text\":\"reason\"},{\"text\":\"answer\"}]},\"finishReason\":\"STOP\"}]}\n\n"),
        ] {
            let mut parser = StreamParser::default();
            let mut reasoning = String::new();
            parser.push(input.as_bytes(), protocol, &mut |v| reasoning.push_str(&v.reasoning)).unwrap();
            assert_eq!(parser.finish(protocol, &mut |_| {}).unwrap(), "answer");
            assert_eq!(reasoning, "reason");
        }
    }
}
