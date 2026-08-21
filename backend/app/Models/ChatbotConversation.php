<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatbotConversation extends Model
{
    protected $table = 'chatbot_conversations';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['session_id', 'user_id', 'messages', 'context'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
