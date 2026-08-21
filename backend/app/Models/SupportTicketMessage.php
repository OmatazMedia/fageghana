<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupportTicketMessage extends Model
{
    protected $table = 'support_ticket_messages';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['ticket_id', 'user_id', 'message', 'is_admin', 'attachments'];


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
