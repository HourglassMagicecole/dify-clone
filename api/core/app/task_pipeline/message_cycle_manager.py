import logging
from typing import Union

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.app.entities.app_invoke_entities import (
    AdvancedChatAppGenerateEntity,
    AgentChatAppGenerateEntity,
    ChatAppGenerateEntity,
    CompletionAppGenerateEntity,
)
from core.app.entities.queue_entities import (
    QueueAnnotationReplyEvent,
    QueueMessageFileEvent,
    QueueRetrieverResourcesEvent,
)
from core.app.entities.task_entities import (
    AnnotationReply,
    AnnotationReplyAccount,
    EasyUITaskState,
    MessageFileStreamResponse,
    MessageReplaceStreamResponse,
    MessageStreamResponse,
    StreamEvent,
    WorkflowTaskState,
)
from core.tools.signature import sign_tool_file
from extensions.ext_database import db
from models.model import Conversation, Message, MessageAnnotation, MessageFile
from services.annotation_service import AppAnnotationService

logger = logging.getLogger(__name__)


class MessageCycleManager:
    def __init__(
        self,
        *,
        application_generate_entity: Union[
            ChatAppGenerateEntity,
            CompletionAppGenerateEntity,
            AgentChatAppGenerateEntity,
            AdvancedChatAppGenerateEntity,
        ],
        task_state: Union[EasyUITaskState, WorkflowTaskState],
    ):
        self._application_generate_entity = application_generate_entity
        self._task_state = task_state

    def generate_conversation_name(self, *, conversation_id: str, query: str) -> str | None:
        """
        Generate conversation name from the first user message.
        Uses simple truncation instead of LLM for reliability and speed.

        :param conversation_id: conversation id
        :param query: user's first message
        :return: generated name or None
        """
        if isinstance(self._application_generate_entity, CompletionAppGenerateEntity):
            return None

        # Check if this is the first message
        is_first_message = self._application_generate_entity.conversation_id is None
        if not is_first_message and conversation_id:
            # Query actual message count from Message table
            stmt = select(func.count()).select_from(Message).where(Message.conversation_id == conversation_id)
            message_count = db.session.scalar(stmt) or 0
            is_first_message = message_count <= 1

        extras = self._application_generate_entity.extras
        auto_generate_conversation_name = extras.get("auto_generate_conversation_name", True)

        if auto_generate_conversation_name and is_first_message:
            # Generate name from first message (truncate if too long)
            max_length = 30
            name = query.strip()
            if len(name) > max_length:
                name = name[:max_length] + "..."

            # Update conversation name in database
            stmt = select(Conversation).where(Conversation.id == conversation_id)
            conversation = db.session.scalar(stmt)
            if conversation:
                conversation.name = name
                db.session.commit()
                return name

        return None

    def handle_annotation_reply(self, event: QueueAnnotationReplyEvent) -> MessageAnnotation | None:
        """
        Handle annotation reply.
        :param event: event
        :return:
        """
        annotation = AppAnnotationService.get_annotation_by_id(event.message_annotation_id)
        if annotation:
            account = annotation.account
            self._task_state.metadata.annotation_reply = AnnotationReply(
                id=annotation.id,
                account=AnnotationReplyAccount(
                    id=annotation.account_id,
                    name=account.name if account else "Dify user",
                ),
            )

            return annotation

        return None

    def handle_retriever_resources(self, event: QueueRetrieverResourcesEvent):
        """
        Handle retriever resources.
        :param event: event
        :return:
        """
        if not self._application_generate_entity.app_config.additional_features:
            raise ValueError("Additional features not found")
        if self._application_generate_entity.app_config.additional_features.show_retrieve_source:
            self._task_state.metadata.retriever_resources = event.retriever_resources

    def message_file_to_stream_response(self, event: QueueMessageFileEvent) -> MessageFileStreamResponse | None:
        """
        Message file to stream response.
        :param event: event
        :return:
        """
        with Session(db.engine, expire_on_commit=False) as session:
            message_file = session.scalar(select(MessageFile).where(MessageFile.id == event.message_file_id))

        if message_file and message_file.url is not None:
            # get tool file id
            tool_file_id = message_file.url.split("/")[-1]
            # trim extension
            tool_file_id = tool_file_id.split(".")[0]

            # get extension
            if "." in message_file.url:
                extension = f".{message_file.url.split('.')[-1]}"
                if len(extension) > 10:
                    extension = ".bin"
            else:
                extension = ".bin"
            # add sign url to local file
            if message_file.url.startswith("http"):
                url = message_file.url
            else:
                url = sign_tool_file(tool_file_id=tool_file_id, extension=extension, for_external=True)

            return MessageFileStreamResponse(
                task_id=self._application_generate_entity.task_id,
                id=message_file.id,
                type=message_file.type,
                belongs_to=message_file.belongs_to or "user",
                url=url,
            )

        return None

    def message_to_stream_response(
        self, answer: str, message_id: str, from_variable_selector: list[str] | None = None
    ) -> MessageStreamResponse:
        """
        Message to stream response.
        :param answer: answer
        :param message_id: message id
        :return:
        """
        with Session(db.engine, expire_on_commit=False) as session:
            message_file = session.scalar(select(MessageFile).where(MessageFile.id == message_id))
        event_type = StreamEvent.MESSAGE_FILE if message_file else StreamEvent.MESSAGE

        return MessageStreamResponse(
            task_id=self._application_generate_entity.task_id,
            id=message_id,
            answer=answer,
            from_variable_selector=from_variable_selector,
            event=event_type,
        )

    def message_replace_to_stream_response(self, answer: str, reason: str = "") -> MessageReplaceStreamResponse:
        """
        Message replace to stream response.
        :param answer: answer
        :return:
        """
        return MessageReplaceStreamResponse(
            task_id=self._application_generate_entity.task_id, answer=answer, reason=reason
        )
