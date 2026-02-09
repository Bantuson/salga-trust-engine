"""Unit tests for conversation state manager using fakeredis.

Tests conversation lifecycle with Redis state management: create, get, update,
append turns, clear. Validates GBV/municipal namespace separation.
"""
import pytest
from fakeredis import aioredis

from src.core.conversation import ConversationManager, ConversationState


@pytest.fixture
async def conversation_manager():
    """Create conversation manager with fake Redis."""
    # Create fake Redis connection
    fake_redis = aioredis.FakeRedis(decode_responses=True)

    # Create manager and inject fake Redis
    manager = ConversationManager(redis_url="redis://fake", default_ttl=3600)
    manager._redis = fake_redis

    yield manager

    # Cleanup
    await fake_redis.flushall()
    await fake_redis.aclose()


async def test_create_session(conversation_manager):
    """Test creating a new conversation session."""
    state = await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en"
    )

    assert isinstance(state, ConversationState)
    assert state.user_id == "user123"
    assert state.session_id == "session456"
    assert state.tenant_id == "tenant789"
    assert state.language == "en"
    assert state.category is None
    assert len(state.turns) == 0
    assert state.created_at > 0


async def test_get_state_returns_none_for_nonexistent(conversation_manager):
    """Test get_state returns None for nonexistent session."""
    state = await conversation_manager.get_state(
        user_id="nonexistent",
        session_id="nosession"
    )

    assert state is None


async def test_get_state_returns_created_session(conversation_manager):
    """Test get_state returns previously created session."""
    # Create session
    created_state = await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="zu"
    )

    # Retrieve session
    retrieved_state = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456"
    )

    assert retrieved_state is not None
    assert retrieved_state.user_id == created_state.user_id
    assert retrieved_state.session_id == created_state.session_id
    assert retrieved_state.language == "zu"


async def test_append_turn_adds_turn(conversation_manager):
    """Test append_turn adds turn and returns updated state."""
    # Create session
    await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en"
    )

    # Append user turn
    updated_state = await conversation_manager.append_turn(
        user_id="user123",
        session_id="session456",
        role="user",
        content="There is a water leak"
    )

    assert len(updated_state.turns) == 1
    assert updated_state.turns[0]["role"] == "user"
    assert updated_state.turns[0]["content"] == "There is a water leak"
    assert updated_state.turns[0]["timestamp"] > 0


async def test_append_multiple_turns(conversation_manager):
    """Test appending multiple turns maintains conversation history."""
    # Create session
    await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en"
    )

    # Add multiple turns
    await conversation_manager.append_turn(
        user_id="user123",
        session_id="session456",
        role="user",
        content="Water leak on Main Street"
    )

    await conversation_manager.append_turn(
        user_id="user123",
        session_id="session456",
        role="agent",
        content="Can you provide more details about the location?"
    )

    await conversation_manager.append_turn(
        user_id="user123",
        session_id="session456",
        role="user",
        content="It's near the library, number 45"
    )

    # Get final state
    state = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456"
    )

    assert len(state.turns) == 3
    assert state.turns[0]["role"] == "user"
    assert state.turns[1]["role"] == "agent"
    assert state.turns[2]["role"] == "user"


async def test_max_turns_enforcement(conversation_manager):
    """Test max_turns enforcement raises ValueError."""
    # Create session
    await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en"
    )

    # Add max_turns (20 by default)
    for i in range(20):
        await conversation_manager.append_turn(
            user_id="user123",
            session_id="session456",
            role="user" if i % 2 == 0 else "agent",
            content=f"Turn {i}"
        )

    # 21st turn should raise ValueError
    with pytest.raises(ValueError, match="Max turns"):
        await conversation_manager.append_turn(
            user_id="user123",
            session_id="session456",
            role="user",
            content="This should fail"
        )


async def test_append_turn_raises_for_nonexistent_session(conversation_manager):
    """Test append_turn raises ValueError for nonexistent session."""
    with pytest.raises(ValueError, match="Conversation state not found"):
        await conversation_manager.append_turn(
            user_id="nonexistent",
            session_id="nosession",
            role="user",
            content="This should fail"
        )


async def test_clear_session_removes_state(conversation_manager):
    """Test clear_session removes state from Redis."""
    # Create session
    await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en"
    )

    # Verify it exists
    state = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456"
    )
    assert state is not None

    # Clear session
    await conversation_manager.clear_session(
        user_id="user123",
        session_id="session456"
    )

    # Verify it's gone
    state = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456"
    )
    assert state is None


async def test_gbv_namespace_separation(conversation_manager):
    """Test GBV and municipal conversations don't collide."""
    # Create municipal conversation
    municipal_state = await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en",
        is_gbv=False
    )

    # Create GBV conversation with same user/session IDs
    gbv_state = await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en",
        is_gbv=True
    )

    # Both should exist independently
    municipal_retrieved = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456",
        is_gbv=False
    )
    gbv_retrieved = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456",
        is_gbv=True
    )

    assert municipal_retrieved is not None
    assert gbv_retrieved is not None

    # Add turn to municipal
    await conversation_manager.append_turn(
        user_id="user123",
        session_id="session456",
        role="user",
        content="Municipal issue",
        is_gbv=False
    )

    # Add turn to GBV
    await conversation_manager.append_turn(
        user_id="user123",
        session_id="session456",
        role="user",
        content="GBV issue",
        is_gbv=True
    )

    # Verify they're separate
    municipal_final = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456",
        is_gbv=False
    )
    gbv_final = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456",
        is_gbv=True
    )

    assert len(municipal_final.turns) == 1
    assert len(gbv_final.turns) == 1
    assert municipal_final.turns[0]["content"] == "Municipal issue"
    assert gbv_final.turns[0]["content"] == "GBV issue"


async def test_clear_gbv_session_doesnt_affect_municipal(conversation_manager):
    """Test clearing GBV session doesn't affect municipal session."""
    # Create both types
    await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en",
        is_gbv=False
    )

    await conversation_manager.create_session(
        user_id="user123",
        session_id="session456",
        tenant_id="tenant789",
        language="en",
        is_gbv=True
    )

    # Clear GBV session
    await conversation_manager.clear_session(
        user_id="user123",
        session_id="session456",
        is_gbv=True
    )

    # Municipal should still exist
    municipal_state = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456",
        is_gbv=False
    )
    assert municipal_state is not None

    # GBV should be gone
    gbv_state = await conversation_manager.get_state(
        user_id="user123",
        session_id="session456",
        is_gbv=True
    )
    assert gbv_state is None
