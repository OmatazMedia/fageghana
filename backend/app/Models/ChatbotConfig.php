<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatbotConfig extends Model
{
    protected $table = 'chatbot_configs';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['singleton', 'welcome_message', 'system_prompt', 'model', 'temperature', 'max_tokens', 'is_active'];


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
