//! Reading back what the server logs, for tests of the log lines (crit 10).

/// Somewhere JSON log lines go, for a test to read back.
#[derive(Clone, Default)]
pub struct LogSink(std::sync::Arc<std::sync::Mutex<Vec<u8>>>);

impl std::io::Write for LogSink {
    fn write(&mut self, data: &[u8]) -> std::io::Result<usize> {
        self.0.lock().unwrap().extend_from_slice(data);
        Ok(data.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl LogSink {
    /// Logs into this sink, as the server logs, on this thread until the
    /// guard is dropped.
    pub fn capture(&self) -> tracing::subscriber::DefaultGuard {
        // With only one dispatcher registered, tracing works out a new
        // callsite's interest from the default of whichever thread reaches it
        // first: another test's thread, logging nowhere, would cache "never"
        // and this sink would miss the line (slice 17's seed, whose callsites
        // its other tests reach first). A second one kept for the run makes
        // it ask every dispatcher instead.
        static ANOTHER: std::sync::OnceLock<()> = std::sync::OnceLock::new();
        ANOTHER.get_or_init(|| {
            let (ready, registered) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                let _quiet = tracing::subscriber::set_default(tracing::subscriber::NoSubscriber::default());
                let _ = ready.send(());
                loop {
                    std::thread::park();
                }
            });
            let _ = registered.recv();
        });
        let writer = self.clone();
        let subscriber = tracing_subscriber::fmt()
            .json()
            .flatten_event(true)
            .with_writer(move || writer.clone())
            .finish();
        tracing::subscriber::set_default(subscriber)
    }

    /// Each line logged so far, parsed.
    pub fn lines(&self) -> Vec<serde_json::Value> {
        self.text().lines().filter_map(|l| serde_json::from_str(l).ok()).collect()
    }

    pub fn text(&self) -> String {
        String::from_utf8(self.0.lock().unwrap().clone()).unwrap()
    }
}
