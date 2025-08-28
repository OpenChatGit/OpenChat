import os
import logging
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, flash
from flask_session import Session
import uuid

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev_secret_key_12345")

# Configure session
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
Session(app)

# In-memory storage for conversations (in production, use a database)
conversations = {}

@app.route('/')
def index():
    """Main chat interface"""
    # Initialize user session if not exists
    if 'user_id' not in session:
        session['user_id'] = str(uuid.uuid4())
    
    user_id = session['user_id']
    
    # Get user's conversations
    user_conversations = []
    if user_id in conversations:
        user_conversations = list(conversations[user_id].values())
        # Sort by last updated (most recent first)
        user_conversations.sort(key=lambda x: x['updated_at'], reverse=True)
    
    # Get current conversation
    current_conversation_id = request.args.get('conversation_id')
    current_conversation = None
    if current_conversation_id and user_id in conversations and current_conversation_id in conversations[user_id]:
        current_conversation = conversations[user_id][current_conversation_id]
    
    return render_template('index.html', 
                         conversations=user_conversations,
                         current_conversation=current_conversation)

@app.route('/new_conversation')
def new_conversation():
    """Start a new conversation"""
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('index'))
    
    # Create new conversation
    conversation_id = str(uuid.uuid4())
    
    if user_id not in conversations:
        conversations[user_id] = {}
    
    conversations[user_id][conversation_id] = {
        'id': conversation_id,
        'title': 'New Conversation',
        'messages': [],
        'created_at': datetime.now(),
        'updated_at': datetime.now()
    }
    
    return redirect(url_for('index', conversation_id=conversation_id))

@app.route('/send_message', methods=['POST'])
def send_message():
    """Send a message in the current conversation"""
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('index'))
    
    message_content = request.form.get('message', '').strip()
    conversation_id = request.form.get('conversation_id')
    
    if not message_content:
        flash('Please enter a message', 'error')
        return redirect(url_for('index', conversation_id=conversation_id))
    
    # If no conversation ID, create a new one
    if not conversation_id:
        if user_id not in conversations:
            conversations[user_id] = {}
        
        conversation_id = str(uuid.uuid4())
        conversations[user_id][conversation_id] = {
            'id': conversation_id,
            'title': message_content[:50] + ('...' if len(message_content) > 50 else ''),
            'messages': [],
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
    
    # Ensure conversation exists
    if user_id not in conversations or conversation_id not in conversations[user_id]:
        flash('Conversation not found', 'error')
        return redirect(url_for('index'))
    
    conversation = conversations[user_id][conversation_id]
    
    # Add user message
    user_message = {
        'role': 'user',
        'content': message_content,
        'timestamp': datetime.now()
    }
    conversation['messages'].append(user_message)
    
    # Update conversation title if it's the first message
    if len(conversation['messages']) == 1:
        conversation['title'] = message_content[:50] + ('...' if len(message_content) > 50 else '')
    
    # Generate AI response (simulated for this demo)
    ai_response = generate_ai_response(message_content)
    ai_message = {
        'role': 'assistant',
        'content': ai_response,
        'timestamp': datetime.now()
    }
    conversation['messages'].append(ai_message)
    
    # Update conversation timestamp
    conversation['updated_at'] = datetime.now()
    
    return redirect(url_for('index', conversation_id=conversation_id))

@app.route('/delete_conversation/<conversation_id>')
def delete_conversation(conversation_id):
    """Delete a conversation"""
    user_id = session.get('user_id')
    if not user_id:
        return redirect(url_for('index'))
    
    if user_id in conversations and conversation_id in conversations[user_id]:
        del conversations[user_id][conversation_id]
        flash('Conversation deleted', 'success')
    
    return redirect(url_for('index'))

def generate_ai_response(user_message):
    """Generate a simulated AI response"""
    # This is a simple simulation - in a real app, you'd integrate with an AI API
    
    # Simple keyword-based responses in German
    message_lower = user_message.lower()
    if any(word in message_lower for word in ['hallo', 'hi', 'hey', 'guten tag']):
        return "Hallo! Wie kann ich dir heute helfen?"
    elif any(word in message_lower for word in ['hilfe', 'hilfst', 'unterstützung']):
        return "Ich bin hier, um zu helfen! Womit kann ich dir behilflich sein?"
    elif any(word in message_lower for word in ['code', 'programmierung', 'python', 'programmieren']):
        return "Ich kann bei Programmierfragen helfen! Hier ist ein Beispiel:\n\n```python\ndef hallo_welt():\n    print('Hallo, Welt!')\n```\n\nWelches spezifische Programmthema möchtest du erkunden?"
    else:
        import random
        german_responses = [
            "Ich verstehe deine Frage. Das ist eine simulierte Antwort von der ChatGPT-ähnlichen Oberfläche.",
            "Das ist ein interessanter Punkt. Lass mich dir eine hilfreiche Antwort geben.",
            "Vielen Dank für deine Nachricht. Ich bin hier, um bei allen Fragen zu helfen.",
            "Ich sehe, worum es dir geht. Hier ist meine Perspektive zu diesem Thema.",
            "Gute Frage! Ich helfe gerne dabei, das weiter zu erkunden."
        ]
        return random.choice(german_responses)

if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=True)
