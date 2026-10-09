//! Wire types for the WebSocket (ADR 0004) and the accounts API (ADR 0007).
//! ts-rs writes a TypeScript file for each into client/src/protocol when
//! `cargo test` runs; those files are never edited by hand (AGENTS.md).
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A tile of the café floor; (0, 0) is the top-left, on the street wall.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Tile {
    pub x: u8,
    pub y: u8,
}

/// A walk, sent once and animated by every client: the path's tiles in order,
/// when it started (server milliseconds) and tiles per second.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Walk {
    pub path: Vec<Tile>,
    pub start: u64,
    pub speed: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Look {
    pub avatar: u8,
    pub colour: u8,
}

/// Inside the café, or waiting at the window (ADR 0008).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Place {
    Inside,
    Window,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PersonView {
    pub id: u32,
    pub name: String,
    pub look: Look,
    pub place: Place,
    pub at: Tile,
    pub walk: Option<Walk>,
    /// Sitting on a piece of furniture at `at`.
    pub sitting: bool,
}

/// A piece someone is carrying.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct HeldView {
    pub by: u32,
    pub piece: FurnitureView,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Pose {
    #[default]
    Idle,
    Walk,
    Nap,
    Sit,
    Hide,
    Eat,
    Groom,
    Play,
    /// In someone's arms; `CatView.held_by` says whose.
    Held,
}

/// A moment a cat shows over its head.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export)]
pub enum Reaction {
    LookUp {
        at: u32,
    },
    Sniff {
        by: u32,
    },
    Purr {
        by: u32,
    },
    Tolerate {
        by: u32,
    },
    Refuse {
        by: u32,
    },
    Greet {
        to: u32,
    },
    /// Lashed out at unwelcome handling: trust down.
    Scratch {
        by: u32,
    },
    /// Took a treat from someone's hand.
    Eat {
        from: u32,
    },
    Play {
        with: u32,
    },
    /// Jumped off a piece someone picked up.
    Annoyed {
        by: u32,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CatView {
    pub id: String,
    pub name: String,
    pub coat: String,
    pub at: Tile,
    pub pose: Pose,
    pub walk: Option<Walk>,
    pub held_by: Option<u32>,
}

/// A treat someone put down, until a cat eats it.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TreatView {
    pub id: u32,
    pub at: Tile,
}

/// A small gesture anyone inside can make (design.md, "People").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum Emote {
    Wave,
    Laugh,
    Heart,
    Yawn,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum TrustLevel {
    Stranger,
    Familiar,
    Friend,
    Devoted,
}

/// One cat's trust in you, 0 to 100, sent only to you.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TrustView {
    pub cat: String,
    pub value: f32,
    pub level: TrustLevel,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FurnitureView {
    pub id: u32,
    pub kind: String,
    pub x: u8,
    pub y: u8,
    pub w: u8,
    pub h: u8,
    pub movable: bool,
    pub blocks: bool,
    /// Other pieces can stand on it, as on a rug.
    pub under: bool,
    pub seats: bool,
    /// Knocked over by a cat, until someone stands it back up.
    pub toppled: bool,
}

/// A kind of furniture the catalogue offers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct KindView {
    pub kind: String,
    pub w: u8,
    pub h: u8,
    pub blocks: bool,
    pub under: bool,
    pub seats: bool,
}

/// The floor plan: `tiles` holds one string per row (W wall, G window, D door,
/// C chalkboard, . floor). `furniture` is what stands on the floor, not what
/// someone carries.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RoomView {
    pub width: u8,
    pub height: u8,
    pub tiles: Vec<String>,
    pub door: Tile,
    /// The door's walkway, which nothing may stand on.
    pub walkway: Vec<Tile>,
    pub furniture: Vec<FurnitureView>,
    pub catalogue: Vec<KindView>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Snapshot {
    pub room: RoomView,
    pub people: Vec<PersonView>,
    pub cats: Vec<CatView>,
    pub your_trust: Vec<TrustView>,
    pub held: Vec<HeldView>,
    pub treats: Vec<TreatView>,
    /// Treats you have left today.
    pub your_treats: u32,
    /// Portions in the bowls.
    pub bowls: u8,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum ErrorCode {
    Empty,
    TooLong,
    RateLimited,
    NotFromWindow,
    UnknownCat,
    UnknownPerson,
    BadTile,
    MovedAway,
    CantPlace,
    /// Someone else has it, or is on their way to it.
    Taken,
    /// The floor holds no more furniture.
    Full,
    NotHolding,
    /// A cat won't let you do this, for a while yet.
    Banned,
    NoTreats,
    /// You're carrying a cat or a piece already.
    HandsFull,
}

/// What a client asks for. The server decides what happens (AGENTS.md).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase")]
#[ts(export)]
pub enum ClientMsg {
    WalkTo {
        tile: Tile,
    },
    Say {
        text: String,
        to: Option<u32>,
    },
    Pet {
        cat: String,
    },
    Call {
        cat: String,
    },
    /// Walk over to a piece and pick it up.
    Grab {
        id: u32,
    },
    /// Take a new piece of this kind from the catalogue, in your hands.
    Take {
        kind: String,
    },
    /// Walk over and put what you're carrying down with its top-left at `to`.
    Place {
        to: Tile,
    },
    /// Put what you're carrying back where it was (a new piece just goes).
    PutBack {},
    /// Put what you're carrying away, out of the café.
    PutAway {},
    /// Walk over to a piece and sit on it.
    Sit {
        id: u32,
    },
    /// Put one of your treats down at your feet.
    PutTreat {},
    /// Walk over and offer a cat a treat from your hand.
    OfferTreat {
        cat: String,
    },
    /// Hand one of your treats to someone inside.
    GiveTreat {
        to: u32,
    },
    Play {
        cat: String,
    },
    PickUp {
        cat: String,
    },
    /// Set down the cat you're holding.
    PutDown {},
    /// Pass the cat you're holding to someone beside you.
    PassCat {
        to: u32,
    },
    /// Walk over and stand a knocked-over piece back up.
    Tidy {
        id: u32,
    },
    Leave {},
    /// The tab was hidden or shown again (ADR 0009's quiet signals).
    Presence {
        hidden: bool,
    },
    /// Someone touched the page: still here. Also answers "still there?".
    Here {},
    Emote {
        emote: Emote,
    },
}

/// What the server tells clients: a snapshot on joining, then events in order.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
#[ts(export)]
pub enum ServerMsg {
    Welcome {
        you: u32,
        build: String,
        now: u64,
        cap: u32,
        snapshot: Snapshot,
    },
    Replaced {},
    PersonJoined {
        person: PersonView,
    },
    PersonLeft {
        id: u32,
    },
    PersonPlaced {
        id: u32,
        place: Place,
        at: Tile,
        walk: Option<Walk>,
    },
    PersonMoved {
        id: u32,
        walk: Walk,
    },
    CatMoved {
        cat: String,
        walk: Walk,
    },
    CatPosed {
        cat: String,
        pose: Pose,
        at: Tile,
    },
    CatReacted {
        cat: String,
        reaction: Reaction,
    },
    Said {
        from: u32,
        text: String,
        to: Option<u32>,
        ttl_ms: u32,
    },
    YourTrust {
        trust: TrustView,
    },
    Emoted {
        from: u32,
        emote: Emote,
    },
    /// Sent to you alone: you've gone quiet while someone waits at the
    /// window; answer within `secs` seconds or your seat goes to them.
    StillThere {
        secs: u32,
    },
    /// Sent to you alone: the "still there?" is over, answered or not needed.
    NudgeOver {},
    /// `by` picked a piece up (or took a new one): it's off the floor, in their hands.
    FurnitureHeld {
        piece: FurnitureView,
        by: u32,
    },
    /// A piece is on the floor where it says; `by` put it there.
    FurniturePlaced {
        piece: FurnitureView,
        by: u32,
    },
    /// A piece is gone from the café; `by` put it away.
    FurnitureRemoved {
        id: u32,
        by: u32,
    },
    PersonSat {
        id: u32,
        at: Tile,
    },
    TreatPlaced {
        treat: TreatView,
        by: u32,
    },
    TreatEaten {
        id: u32,
        cat: String,
    },
    /// Sent to one person: treats they have left today.
    YourTreats {
        left: u32,
    },
    TreatGiven {
        from: u32,
        to: u32,
    },
    /// Portions in the bowls, after a refill or a meal.
    Bowls {
        portions: u8,
    },
    /// A cat was picked up, passed, or (with `by` none) is down again.
    CatHeld {
        cat: String,
        by: Option<u32>,
    },
    FurnitureToppled {
        id: u32,
        toppled: bool,
        by: Option<u32>,
    },
    Error {
        code: ErrorCode,
        detail: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SignUpRequest {
    pub name: String,
    pub password: String,
    pub look: Look,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct LogInRequest {
    pub name: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct RecoverRequest {
    pub name: String,
    pub code: String,
    pub password: String,
}

/// Who you are. The recovery code is present only when it has just been
/// made, at sign-up or recovery, and is never shown again.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ApiMe {
    pub id: u32,
    pub name: String,
    pub look: Look,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    #[ts(optional)]
    pub recovery_code: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub enum ApiErrorCode {
    BadInput,
    NameTaken,
    BadLogin,
    BadRecovery,
    RateLimited,
    Forbidden,
    SignedOut,
    Server,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ApiError {
    pub error: ApiErrorCode,
    pub detail: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn client_messages_read_the_json_the_client_sends() {
        let walk: ClientMsg = serde_json::from_str(r#"{"type":"walkTo","tile":{"x":3,"y":4}}"#).unwrap();
        assert_eq!(walk, ClientMsg::WalkTo { tile: Tile { x: 3, y: 4 } });
        let say: ClientMsg = serde_json::from_str(r#"{"type":"say","text":"hi","to":null}"#).unwrap();
        assert_eq!(
            say,
            ClientMsg::Say {
                text: "hi".into(),
                to: None
            }
        );
        let leave: ClientMsg = serde_json::from_str(r#"{"type":"leave"}"#).unwrap();
        assert_eq!(leave, ClientMsg::Leave {});
    }

    #[test]
    fn server_messages_use_camel_case_names() {
        let said = ServerMsg::Said {
            from: 1,
            text: "hi".into(),
            to: None,
            ttl_ms: 3120,
        };
        assert_eq!(
            serde_json::to_string(&said).unwrap(),
            r#"{"type":"said","from":1,"text":"hi","to":null,"ttlMs":3120}"#
        );
        let posed = ServerMsg::CatPosed {
            cat: "mochi".into(),
            pose: Pose::Nap,
            at: Tile { x: 1, y: 5 },
        };
        assert_eq!(
            serde_json::to_string(&posed).unwrap(),
            r#"{"type":"catPosed","cat":"mochi","pose":"nap","at":{"x":1,"y":5}}"#
        );
        let reacted = ServerMsg::CatReacted {
            cat: "tora".into(),
            reaction: Reaction::Purr { by: 2 },
        };
        assert_eq!(
            serde_json::to_string(&reacted).unwrap(),
            r#"{"type":"catReacted","cat":"tora","reaction":{"kind":"purr","by":2}}"#
        );
    }

    #[test]
    fn the_snapshot_and_me_use_camel_case_fields() {
        let snapshot = Snapshot {
            room: RoomView {
                width: 1,
                height: 1,
                tiles: vec![".".into()],
                door: Tile { x: 0, y: 0 },
                walkway: vec![],
                furniture: vec![],
                catalogue: vec![],
            },
            people: vec![],
            cats: vec![],
            your_trust: vec![],
            held: vec![],
            treats: vec![],
            your_treats: 3,
            bowls: 3,
        };
        assert!(serde_json::to_string(&snapshot).unwrap().contains(r#""yourTrust":[]"#));
        let me = ApiMe {
            id: 1,
            name: "sam".into(),
            look: Look { avatar: 0, colour: 1 },
            recovery_code: Some("X".into()),
        };
        assert!(serde_json::to_string(&me).unwrap().contains(r#""recoveryCode":"X""#));
    }

    #[test]
    fn me_leaves_out_a_recovery_code_it_does_not_have() {
        let me = ApiMe {
            id: 1,
            name: "sam".into(),
            look: Look { avatar: 0, colour: 1 },
            recovery_code: None,
        };
        assert_eq!(
            serde_json::to_string(&me).unwrap(),
            r#"{"id":1,"name":"sam","look":{"avatar":0,"colour":1}}"#
        );
    }
}
